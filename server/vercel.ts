import { createDb } from '../src/worker/pg'
import type { Bindings } from '../src/worker/types'
import app from '../src/worker/index'

/**
 * Vercel entry point. `scripts/build-vercel-output.mjs` bundles this into
 * `.vercel/output/functions/api.func/index.js`, the file Vercel runs at
 * /api/*. It is bundled because Vercel transpiles TypeScript file by file and
 * would leave the app's extensionless ESM imports unresolvable at runtime.
 *
 * The SPA and its static files are served by Vercel itself, so the Worker's
 * ASSETS fallback is never used on this host. Values come from the project's
 * environment variables (Vercel → Settings → Environment Variables).
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

/** Vercel's Node launcher calls the `fetch` export for Web-standard handlers. */
export const fetch = async (request: Request): Promise<Response> => app.fetch(request, env)
