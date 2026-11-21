import { ApiError, type Bindings, type DocRow } from './types'

export async function getOwnedDocument(env: Bindings, userId: string, id: string): Promise<DocRow> {
  const row = await env.DB.prepare('SELECT * FROM documents WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .first<DocRow>()
  if (!row) throw new ApiError(404, 'Document not found.')
  return row
}

export function documentSummary(row: DocRow) {
  return {
    id: row.id,
    filename: row.filename,
    fileType: row.file_type,
    fileSize: row.file_size,
    pageCount: row.page_count,
    uploadDate: row.upload_date,
    processingStatus: row.processing_status,
    errorMessage: row.error_message,
    hasAnalysis: Boolean(row.summary_json),
    textLength: row.extracted_text.length,
    wordCount: row.extracted_text ? row.extracted_text.trim().split(/\s+/).length : 0,
  }
}

export function parseAnalysis(json: string | null) {
  if (!json) return null
  try {
    return JSON.parse(json) as {
      summary: string
      topics: string[]
      concepts: string[]
      definitions: { term: string; meaning: string }[]
      keyPoints: string[]
      examQuestions: string[]
      chapters: { title: string; summary: string }[]
    }
  } catch {
    return null
  }
}
