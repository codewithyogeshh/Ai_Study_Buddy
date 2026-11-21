import { Hono } from 'hono'

import { newId, nowIso } from '../db'
import { readJson, str } from '../middleware'
import { ApiError, type AppEnv } from '../types'

type NoteRow = {
  id: string
  user_id: string
  document_id: string | null
  title: string
  content: string
  language: string
  style: string
  created_at: string
  updated_at: string
}

function noteView(row: NoteRow) {
  return {
    id: row.id,
    documentId: row.document_id,
    title: row.title,
    content: row.content,
    language: row.language,
    style: row.style,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function ownedNote(env: AppEnv['Bindings'], userId: string, id: string): Promise<NoteRow> {
  const row = await env.DB.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?').bind(id, userId).first<NoteRow>()
  if (!row) throw new ApiError(404, 'Note not found.')
  return row
}

export const noteRoutes = new Hono<AppEnv>()

noteRoutes.get('/', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM notes WHERE user_id = ? ORDER BY updated_at DESC')
    .bind(c.get('userId'))
    .all<NoteRow>()
  return c.json({ notes: (results ?? []).map(noteView) })
})

noteRoutes.get('/:id', async (c) => {
  return c.json({ note: noteView(await ownedNote(c.env, c.get('userId'), c.req.param('id'))) })
})

noteRoutes.post('/', async (c) => {
  const body = await readJson(c)
  const now = nowIso()
  const row: NoteRow = {
    id: newId('note'),
    user_id: c.get('userId'),
    document_id: typeof body.documentId === 'string' ? body.documentId : null,
    title: str(body.title, 'Title', { max: 200 }),
    content: str(body.content, 'Content', { max: 200_000 }),
    language: str(body.language ?? 'english', 'Language', { max: 20 }),
    style: str(body.style ?? 'detailed', 'Style', { max: 30 }),
    created_at: now,
    updated_at: now,
  }
  await c.env.DB.prepare(
    'INSERT INTO notes (id, user_id, document_id, title, content, language, style, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(row.id, row.user_id, row.document_id, row.title, row.content, row.language, row.style, row.created_at, row.updated_at)
    .run()
  return c.json({ note: noteView(row) }, 201)
})

noteRoutes.put('/:id', async (c) => {
  const existing = await ownedNote(c.env, c.get('userId'), c.req.param('id'))
  const body = await readJson(c)
  const title = body.title === undefined ? existing.title : str(body.title, 'Title', { max: 200 })
  const content = body.content === undefined ? existing.content : str(body.content, 'Content', { max: 200_000 })
  await c.env.DB.prepare('UPDATE notes SET title = ?, content = ?, updated_at = ? WHERE id = ? AND user_id = ?')
    .bind(title, content, nowIso(), existing.id, existing.user_id)
    .run()
  return c.json({ note: noteView(await ownedNote(c.env, existing.user_id, existing.id)) })
})

noteRoutes.delete('/:id', async (c) => {
  const existing = await ownedNote(c.env, c.get('userId'), c.req.param('id'))
  await c.env.DB.prepare('DELETE FROM notes WHERE id = ? AND user_id = ?').bind(existing.id, existing.user_id).run()
  return c.json({ ok: true })
})
