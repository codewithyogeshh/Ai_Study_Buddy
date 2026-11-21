import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'

import { ensureSchema } from './db'
import { DEFAULT_MODEL, aiConfigured } from './gemini'
import { bootstrap, requireAuth } from './middleware'
import { aiRoutes } from './routes/ai'
import { analyticsRoutes } from './routes/analytics'
import { authRoutes } from './routes/auth'
import { chatRoutes } from './routes/chats'
import { documentRoutes } from './routes/documents'
import { flashcardRoutes } from './routes/flashcards'
import { noteRoutes } from './routes/notes'
import { quizRoutes } from './routes/quizzes'
import { taskRoutes } from './routes/tasks'
import { vivaRoutes } from './routes/viva'
import { ApiError, type AppEnv } from './types'

const app = new Hono<AppEnv>()

// Only API responses: asset responses from the ASSETS binding have immutable
// headers, so adding headers there would throw.
app.use('/api/*', secureHeaders())

/**
 * The SPA is served from the same origin as the API in production, so CORS is
 * only opened for the explicitly configured frontend origins (comma separated).
 */
app.use('/api/*', async (c, next) => {
  const allowed = (c.env.FRONTEND_URL ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean)
  const handler = cors({
    origin: (origin) => {
      if (!origin) return undefined
      const clean = origin.replace(/\/$/, '')
      if (allowed.includes(clean)) return clean
      if (/^https?:\/\/localhost(:\d+)?$/.test(clean) || /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(clean)) return clean
      return undefined
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  })
  return handler(c, next)
})

app.use('/api/*', bootstrap)

app.get('/api/health', async (c) => {
  // Booleans only — never expose configuration values.
  let database = 'missing'
  if (c.env.DB) {
    try {
      await ensureSchema(c.env.DB)
      const row = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM users').first<{ n: number }>()
      database = typeof row?.n === 'number' ? 'ready' : 'unexpected'
    } catch {
      database = 'error'
    }
  }
  return c.json({
    ok: true,
    service: 'ai-study-buddy',
    time: new Date().toISOString(),
    checks: {
      database,
      auth: Boolean(c.env.JWT_SECRET && c.env.JWT_SECRET.length >= 16),
      ai: aiConfigured(c.env),
    },
  })
})

app.get('/api/ai/status', (c) =>
  c.json({
    configured: aiConfigured(c.env),
    model: c.env.GEMINI_MODEL || DEFAULT_MODEL,
    message: aiConfigured(c.env)
      ? 'AI features are available.'
      : 'AI features need GEMINI_API_KEY in the backend environment.',
  }),
)

app.route('/api/auth', authRoutes)

// Everything below requires a valid JWT and only ever touches the caller's rows.
app.use('/api/*', requireAuth)
app.route('/api/documents', documentRoutes)
app.route('/api/ai', aiRoutes)
app.route('/api/chats', chatRoutes)
app.route('/api/notes', noteRoutes)
app.route('/api/quizzes', quizRoutes)
app.route('/api/flashcards', flashcardRoutes)
app.route('/api/tasks', taskRoutes)
app.route('/api/viva', vivaRoutes)
app.route('/api/analytics', analyticsRoutes)

app.all('/api/*', (c) => c.json({ error: 'API route not found.' }, 404))

app.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json({ error: err.message }, err.status as 400)
  }
  console.error('Unhandled API error:', err)
  return c.json({ error: 'Something went wrong on the server. Please try again.' }, 500)
})

// Anything that is not an API call is served by the SPA.
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw))

export default app
