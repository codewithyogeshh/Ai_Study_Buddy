import { Hono } from 'hono'

import { hashPassword, signJwt, verifyPassword } from '../auth'
import { newId, nowIso } from '../db'
import { readJson, email as parseEmail, password as parsePassword, requireAuth, str } from '../middleware'
import { ApiError, type AppEnv } from '../types'

type UserRow = {
  id: string
  name: string
  email: string
  password_hash: string
  language: string
  created_at: string
}

function publicUser(row: UserRow) {
  return { id: row.id, name: row.name, email: row.email, language: row.language, createdAt: row.created_at }
}

function secret(env: AppEnv['Bindings']): string {
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 16) {
    throw new ApiError(500, 'Server is missing a valid JWT_SECRET. Set it in the backend environment.')
  }
  return env.JWT_SECRET
}

/** Tiny per-isolate login throttle: 8 failures per email per 15 minutes. */
const failures = new Map<string, { count: number; resetAt: number }>()

function throttle(key: string) {
  const now = Date.now()
  const entry = failures.get(key)
  if (entry && entry.resetAt > now && entry.count >= 8) {
    throw new ApiError(429, 'Too many failed sign-in attempts. Try again in 15 minutes.')
  }
}

function recordFailure(key: string) {
  const now = Date.now()
  const entry = failures.get(key)
  if (!entry || entry.resetAt <= now) failures.set(key, { count: 1, resetAt: now + 15 * 60_000 })
  else entry.count += 1
}

export const authRoutes = new Hono<AppEnv>()

authRoutes.post('/register', async (c) => {
  const body = await readJson(c)
  const name = str(body.name, 'Name', { min: 2, max: 60 })
  const emailValue = parseEmail(body.email)
  const password = parsePassword(body.password)

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(emailValue).first<{ id: string }>()
  if (existing) throw new ApiError(409, 'An account with this email already exists. Try signing in instead.')

  const user: UserRow = {
    id: newId('usr'),
    name,
    email: emailValue,
    password_hash: await hashPassword(password),
    language: 'english',
    created_at: nowIso(),
  }
  await c.env.DB.prepare(
    'INSERT INTO users (id, name, email, password_hash, language, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  )
    .bind(user.id, user.name, user.email, user.password_hash, user.language, user.created_at)
    .run()

  const token = await signJwt({ sub: user.id, email: user.email, name: user.name }, secret(c.env))
  return c.json({ token, user: publicUser(user) }, 201)
})

authRoutes.post('/login', async (c) => {
  const body = await readJson(c)
  const emailValue = parseEmail(body.email)
  const supplied = typeof body.password === 'string' ? body.password : ''
  const key = emailValue
  throttle(key)

  const row = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(emailValue).first<UserRow>()
  const ok = row ? await verifyPassword(supplied, row.password_hash) : false
  if (!row || !ok) {
    recordFailure(key)
    throw new ApiError(401, 'Email or password is incorrect.')
  }
  failures.delete(key)
  const token = await signJwt({ sub: row.id, email: row.email, name: row.name }, secret(c.env))
  return c.json({ token, user: publicUser(row) })
})

authRoutes.get('/me', requireAuth, async (c) => {
  const row = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(c.get('userId')).first<UserRow>()
  if (!row) throw new ApiError(404, 'Account not found.')
  return c.json({ user: publicUser(row) })
})

authRoutes.put('/profile', requireAuth, async (c) => {
  const body = await readJson(c)
  const name = str(body.name, 'Name', { min: 2, max: 60 })
  const language = typeof body.language === 'string' ? body.language : 'english'
  if (!['english', 'marathi', 'hindi'].includes(language)) throw new ApiError(400, 'Unsupported language.')
  await c.env.DB.prepare('UPDATE users SET name = ?, language = ? WHERE id = ?')
    .bind(name, language, c.get('userId'))
    .run()
  const row = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(c.get('userId')).first<UserRow>()
  return c.json({ user: row ? publicUser(row) : null })
})

authRoutes.post('/change-password', requireAuth, async (c) => {
  const body = await readJson(c)
  const current = typeof body.currentPassword === 'string' ? body.currentPassword : ''
  const next = parsePassword(body.newPassword)
  const row = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(c.get('userId')).first<UserRow>()
  if (!row) throw new ApiError(404, 'Account not found.')
  if (!(await verifyPassword(current, row.password_hash))) throw new ApiError(400, 'Current password is incorrect.')
  await c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(await hashPassword(next), row.id).run()
  return c.json({ ok: true })
})

authRoutes.post('/forgot-password', async (c) => {
  const body = await readJson(c)
  const emailValue = parseEmail(body.email)
  const row = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(emailValue).first<{ id: string }>()
  let devToken: string | undefined
  if (row) {
    const token = crypto.randomUUID().replace(/-/g, '')
    const expires = new Date(Date.now() + 60 * 60_000).toISOString()
    await c.env.DB.prepare('INSERT INTO password_resets (token, user_id, expires_at, used) VALUES (?, ?, ?, 0)')
      .bind(token, row.id, expires)
      .run()
    // No email provider is configured on this deployment, so the token is only
    // returned when explicitly enabled for development/testing.
    if (c.env.FRONTEND_URL === 'debug-reset-token') devToken = token
  }
  return c.json({
    ok: true,
    message:
      'If that email has an account, a reset link has been created. Email delivery is not configured on this deployment, so contact the administrator to complete the reset.',
    ...(devToken ? { resetToken: devToken } : {}),
  })
})

authRoutes.post('/reset-password', async (c) => {
  const body = await readJson(c)
  const token = str(body.token, 'Reset token', { min: 10, max: 200 })
  const next = parsePassword(body.newPassword)
  const reset = await c.env.DB.prepare('SELECT * FROM password_resets WHERE token = ?').bind(token).first<{
    user_id: string
    expires_at: string
    used: number
  }>()
  if (!reset || reset.used || reset.expires_at < nowIso()) {
    throw new ApiError(400, 'This reset link is invalid or has expired. Request a new one.')
  }
  await c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .bind(await hashPassword(next), reset.user_id)
    .run()
  await c.env.DB.prepare('UPDATE password_resets SET used = 1 WHERE token = ?').bind(token).run()
  return c.json({ ok: true })
})
