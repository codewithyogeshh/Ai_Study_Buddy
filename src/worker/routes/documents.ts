import { Hono } from 'hono'

import { analyzeDocument } from '../ai-tasks'
import { newId, nowIso } from '../db'
import { documentSummary, getOwnedDocument, parseAnalysis } from '../documents'
import { capText, extractDocument, fileKind, MAX_FILE_BYTES } from '../extract'
import { aiConfigured } from '../gemini'
import { ApiError, type AppEnv } from '../types'

export const documentRoutes = new Hono<AppEnv>()

documentRoutes.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM documents WHERE user_id = ? ORDER BY upload_date DESC LIMIT 200',
  )
    .bind(c.get('userId'))
    .all()
  return c.json({ documents: (results ?? []).map((r) => documentSummary(r as never)) })
})

documentRoutes.post('/upload', async (c) => {
  const userId = c.get('userId')
  let form: FormData
  try {
    form = await c.req.formData()
  } catch {
    throw new ApiError(400, 'Upload must be multipart form data with a "file" field.')
  }
  const file = form.get('file')
  if (!(file instanceof File)) throw new ApiError(400, 'No file was uploaded.')
  if (file.size === 0) throw new ApiError(400, 'That file is empty.')
  if (file.size > MAX_FILE_BYTES) throw new ApiError(413, 'File is too large. The limit is 15 MB.')

  const kind = fileKind(file.name, file.type)
  if (!kind) throw new ApiError(415, 'Only PDF, TXT and DOCX files are supported.')

  const id = newId('doc')
  const uploadedAt = nowIso()
  const buffer = await file.arrayBuffer()

  let text = ''
  let pageCount = 0
  let warning: string | undefined
  let status = 'ready'
  try {
    const extracted = await extractDocument(buffer, file.name, kind)
    text = capText(extracted.text)
    pageCount = extracted.pageCount
    warning = extracted.warning
    if (extracted.looksScanned) status = 'needs_ocr'
    if (!text.trim()) status = extracted.looksScanned ? 'needs_ocr' : 'empty'
  } catch (err) {
    throw new ApiError(422, err instanceof Error ? err.message : 'The file could not be read.')
  }

  await c.env.DB.prepare(
    `INSERT INTO documents (id, user_id, filename, file_type, file_size, page_count, extracted_text, summary_json, upload_date, processing_status, error_message)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
  )
    .bind(
      id,
      userId,
      file.name.slice(0, 200),
      kind,
      file.size,
      pageCount,
      text,
      uploadedAt,
      status,
      warning ?? null,
    )
    .run()

  // Analyse straight away when the model is available; a failed analysis must
  // never lose the uploaded document.
  let analysisError: string | undefined
  if (text.trim() && aiConfigured(c.env)) {
    try {
      const analysis = await analyzeDocument(c.env, text)
      await c.env.DB.prepare('UPDATE documents SET summary_json = ? WHERE id = ? AND user_id = ?')
        .bind(JSON.stringify(analysis), id, userId)
        .run()
    } catch (err) {
      analysisError = err instanceof Error ? err.message : 'Analysis failed.'
    }
  } else if (!aiConfigured(c.env)) {
    analysisError = 'AI analysis is unavailable because GEMINI_API_KEY is not configured on the server.'
  }

  const row = await getOwnedDocument(c.env, userId, id)
  return c.json(
    {
      document: { ...documentSummary(row), analysis: parseAnalysis(row.summary_json) },
      warning,
      analysisError,
    },
    201,
  )
})

documentRoutes.get('/:id', async (c) => {
  const row = await getOwnedDocument(c.env, c.get('userId'), c.req.param('id'))
  return c.json({
    document: {
      ...documentSummary(row),
      analysis: parseAnalysis(row.summary_json),
      textPreview: row.extracted_text.slice(0, 60_000),
    },
  })
})

documentRoutes.post('/:id/analyze', async (c) => {
  const row = await getOwnedDocument(c.env, c.get('userId'), c.req.param('id'))
  if (!row.extracted_text.trim()) {
    throw new ApiError(422, 'This document has no readable text to analyse. Scanned PDFs require OCR, which is not available here.')
  }
  const analysis = await analyzeDocument(c.env, row.extracted_text)
  await c.env.DB.prepare('UPDATE documents SET summary_json = ? WHERE id = ? AND user_id = ?')
    .bind(JSON.stringify(analysis), row.id, row.user_id)
    .run()
  return c.json({ analysis })
})

documentRoutes.delete('/:id', async (c) => {
  const row = await getOwnedDocument(c.env, c.get('userId'), c.req.param('id'))
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM chats WHERE document_id = ? AND user_id = ?').bind(row.id, row.user_id),
    c.env.DB.prepare('DELETE FROM quizzes WHERE document_id = ? AND user_id = ?').bind(row.id, row.user_id),
    c.env.DB.prepare('DELETE FROM flashcards WHERE document_id = ? AND user_id = ?').bind(row.id, row.user_id),
    c.env.DB.prepare('DELETE FROM notes WHERE document_id = ? AND user_id = ?').bind(row.id, row.user_id),
    c.env.DB.prepare('DELETE FROM documents WHERE id = ? AND user_id = ?').bind(row.id, row.user_id),
  ])
  return c.json({ ok: true })
})
