/** Shared backend types and the bindings the Worker receives. */
export type Bindings = {
  ASSETS: Fetcher
  DB: D1Database
  GEMINI_API_KEY?: string
  JWT_SECRET?: string
  FRONTEND_URL?: string
  GEMINI_MODEL?: string
  GEMINI_FALLBACK_MODEL?: string
  AI_DAILY_LIMIT?: string
}

export type Variables = {
  userId: string
  userEmail: string
  userName: string
}

export type AppEnv = { Bindings: Bindings; Variables: Variables }

/** A minimal, dependency-free row shape for D1 results. */
export type Row = Record<string, unknown>

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export type DocRow = {
  id: string
  user_id: string
  filename: string
  file_type: string
  file_size: number
  page_count: number
  extracted_text: string
  summary_json: string | null
  upload_date: string
  processing_status: string
  error_message: string | null
}
