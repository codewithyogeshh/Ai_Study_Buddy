/**
 * Authentication primitives: PBKDF2 password hashing and a compact HS256 JWT,
 * both on WebCrypto so they run in the Worker without any native dependency.
 */
const enc = new TextEncoder()

function b64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(input: string): Uint8Array {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4))
  const raw = atob(input.replace(/-/g, '+').replace(/_/g, '/') + pad)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

// The Workers runtime rejects PBKDF2 iteration counts above 100,000.
// The count is stored in every hash, so existing hashes keep verifying.
const PBKDF2_ITERATIONS = 100_000

/** WebCrypto's BufferSource typing rejects SharedArrayBuffer-backed views. */
const asBuffer = (bytes: Uint8Array): ArrayBuffer => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: asBuffer(salt), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    256,
  )
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64url(salt)}$${b64url(new Uint8Array(bits))}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
  const iterations = Number(parts[1])
  if (!Number.isFinite(iterations) || iterations < 1000) return false
  const salt = b64urlDecode(parts[2])
  const expected = parts[3]
  let bits: ArrayBuffer
  try {
    const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
    bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: asBuffer(salt), iterations, hash: 'SHA-256' }, key, 256)
  } catch {
    // e.g. a hash created with an iteration count this runtime cannot derive.
    return false
  }
  const actual = b64url(new Uint8Array(bits))
  // Constant-time-ish comparison of equal-length base64 strings.
  if (actual.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < actual.length; i++) diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0
}

type JwtPayload = { sub: string; email: string; name: string; exp: number; iat: number }

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ])
}

export async function signJwt(
  payload: { sub: string; email: string; name: string },
  secret: string,
  ttlSeconds = 60 * 60 * 24 * 7,
): Promise<string> {
  const header = b64url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const now = Math.floor(Date.now() / 1000)
  const body = b64url(enc.encode(JSON.stringify({ ...payload, iat: now, exp: now + ttlSeconds } satisfies JwtPayload)))
  const key = await hmacKey(secret)
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`${header}.${body}`)))
  return `${header}.${body}.${b64url(sig)}`
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const key = await hmacKey(secret)
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    asBuffer(b64urlDecode(parts[2])),
    enc.encode(`${parts[0]}.${parts[1]}`),
  )
  if (!valid) return null
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[1]))) as JwtPayload
    if (!payload?.sub || typeof payload.exp !== 'number') return null
    if (payload.exp * 1000 < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export function bearerToken(header: string | undefined): string | null {
  if (!header) return null
  const m = /^Bearer\s+(.+)$/i.exec(header.trim())
  return m ? m[1] : null
}
