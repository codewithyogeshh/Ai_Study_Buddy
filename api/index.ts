import type { Bindings } from '../src/worker/types'

/**
 * Vercel Node.js function using the `fetch` Web Standard export, which is the
 * form Vercel Functions support for frameworks other than Next.js.
 *
 * `vercel.json` rewrites every /api/* request here; the built SPA and its
 * static files are served by Vercel itself, so the Worker's ASSETS fallback is
 * never used on this host. Values come from the project's environment
 * variables (Vercel → Settings → Environment Variables).
 *
 * The API is imported lazily so a startup failure is reported as JSON with its
 * message instead of an opaque FUNCTION_INVOCATION_FAILED.
 */
function bindings(createDb: () => Bindings['DB']): Bindings {
  return {
    DB: createDb(),
    JWT_SECRET: process.env.JWT_SECRET,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    GEMINI_FALLBACK_MODEL: process.env.GEMINI_FALLBACK_MODEL,
    AI_DAILY_LIMIT: process.env.AI_DAILY_LIMIT,
    FRONTEND_URL: process.env.FRONTEND_URL,
  }
}

export default {
  async fetch(request: Request): Promise<Response> {
    try {
      const [{ default: app }, { createDb }] = await Promise.all([
        import('../src/worker/index'),
        import('../src/worker/pg'),
      ])
      return await app.fetch(request, bindings(createDb))
    } catch (error) {
      const detail = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error)
      console.error('API startup failure:', detail)
      return new Response(JSON.stringify({ error: 'API failed to start.', detail }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      })
    }
  },
}
