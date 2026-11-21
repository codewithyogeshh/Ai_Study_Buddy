import app from '../src/worker/index'
import { createDb } from '../src/worker/pg'
import type { Bindings } from '../src/worker/types'

/**
 * Vercel Node.js function using the `fetch` Web Standard export, which is the
 * form Vercel Functions support for frameworks other than Next.js.
 *
 * `vercel.json` rewrites every /api/* request here; the built SPA and its
 * static files are served by Vercel itself, so the Worker's ASSETS fallback is
 * never used on this host. Values come from the project's environment
 * variables (Vercel → Settings → Environment Variables).
 */
const env: Bindings = {
  DB: createDb(),
  JWT_SECRET: process.env.JWT_SECRET,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL: process.env.GEMINI_MODEL,
  GEMINI_FALLBACK_MODEL: process.env.GEMINI_FALLBACK_MODEL,
  AI_DAILY_LIMIT: process.env.AI_DAILY_LIMIT,
  FRONTEND_URL: process.env.FRONTEND_URL,
}

export default {
  async fetch(request: Request): Promise<Response> {
    return app.fetch(request, env)
  },
}
