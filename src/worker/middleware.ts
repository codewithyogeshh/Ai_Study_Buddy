import type { MiddlewareHandler } from 'hono'

import { bearerToken, verifyJwt } from './auth'
import { ensureSchema } from './db'
import { ApiError, type AppEnv } from './types'

/**
 * Every request bootstraps the schema (idempotent, cached per isolate) and any
 * /api route marked authenticated must present a valid, unexpired JWT.
 */
export const bootstrap: MiddlewareHandler<AppEnv> = async (c, next) => {
  await ensureSchema(c.env.DB)
  await next()
}

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const secret = c.env.JWT_SECRET
  if (!secret || secret.length < 16) {
    throw new ApiError(500, 'Server is missing a valid JWT_SECRET. Set it in the backend environment.')
  }
  const token = bearerToken(c.req.header('authorization'))
  if (!token) throw new ApiError(401, 'Please sign in to continue.')
  const payload = await verifyJwt(token, secret)
  if (!payload) throw new ApiError(401, 'Your session has expired. Please sign in again.')
  c.set('userId', payload.sub)
  c.set('userEmail', payload.email)
  c.set('userName', payload.name)
  await next()
}

/* --------------------------------------------------------------- validation */
export function str(value: unknown, field: string, { min = 1, max = 10_000 }: { min?: number; max?: number } = {}): string {
  if (typeof value !== 'string') throw new ApiError(400, `${field} is required.`)
  const trimmed = value.trim()
  if (trimmed.length < min) throw new ApiError(400, `${field} must be at least ${min} characters.`)
  if (trimmed.length > max) throw new ApiError(400, `${field} must be under ${max} characters.`)
  return trimmed
}

export function optionalStr(value: unknown, field: string, max = 500): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  return str(value, field, { min: 1, max })
}

export function email(value: unknown): string {
  const v = str(value, 'Email', { max: 254 }).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) throw new ApiError(400, 'Enter a valid email address.')
  return v
}

export function password(value: unknown): string {
  const v = typeof value === 'string' ? value : ''
  if (v.length < 8) throw new ApiError(400, 'Password must be at least 8 characters.')
  if (v.length > 128) throw new ApiError(400, 'Password must be under 128 characters.')
  if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) throw new ApiError(400, 'Password must include a letter and a number.')
  return v
}

export function oneOf<T extends string>(value: unknown, allowed: readonly T[], _field: string, fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

export async function readJson(c: { req: { json: () => Promise<unknown> } }): Promise<Record<string, unknown>> {
  const body = await c.req.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError(400, 'Request body must be a JSON object.')
  return body as Record<string, unknown>
}
