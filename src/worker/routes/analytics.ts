import { Hono } from 'hono'

import type { AppEnv } from '../types'

type CountRow = { n: number }

function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

function lastDays(days: number): string[] {
  const out: string[] = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000)
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

function safeJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export const analyticsRoutes = new Hono<AppEnv>()

analyticsRoutes.delete('/sessions', async (c) => {
  await c.env.DB.prepare('DELETE FROM study_sessions WHERE user_id = ?').bind(c.get('userId')).run()
  return c.json({ ok: true })
})

analyticsRoutes.get('/dashboard', async (c) => {
  const userId = c.get('userId')
  const db = c.env.DB
