import { Hono } from 'hono'

import { newId, nowIso } from '../db'
import { getOwnedDocument } from '../documents'
import { optionalStr, readJson, str } from '../middleware'
import { ApiError, type AppEnv } from '../types'

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  at: string
  inDocument?: boolean
  sources?: { page: number | null; note: string }[]
}

export type ChatRow = {
  id: string
  user_id: string
  document_id: string | null
  title: string
  messages: string
  mode: string
  created_at: string
  updated_at: string
}

export function chatView(row: ChatRow) {
  let messages: ChatMessage[] = []
  try {
    messages = JSON.parse(row.messages) as ChatMessage[]
  } catch {
    messages = []
  }
  return {
    id: row.id,
    documentId: row.document_id,
    title: row.title,
    mode: row.mode,
    messages,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function ownedChat(env: AppEnv['Bindings'], userId: string, id: string): Promise<ChatRow> {
  const row = await env.DB.prepare('SELECT * FROM chats WHERE id = ? AND user_id = ?').bind(id, userId).first<ChatRow>()
  if (!row) throw new ApiError(404, 'Chat not found.')
  return row
}

export async function readMessages(row: ChatRow): Promise<ChatMessage[]> {
  try {
    const parsed = JSON.parse(row.messages)
    return Array.isArray(parsed) ? (parsed as ChatMessage[]) : []
  } catch {
    return []
  }
}

export const chatRoutes = new Hono<AppEnv>()

chatRoutes.get('/', async (c) => {
  const documentId = c.req.query('documentId')
  const sql = documentId
    ? 'SELECT * FROM chats WHERE user_id = ? AND document_id = ? ORDER BY updated_at DESC LIMIT 100'
    : 'SELECT * FROM chats WHERE user_id = ? ORDER BY updated_at DESC LIMIT 100'
  const stmt = c.env.DB.prepare(sql)
  const { results } = await (documentId ? stmt.bind(c.get('userId'), documentId) : stmt.bind(c.get('userId'))).all<ChatRow>()
  return c.json({
    chats: (results ?? []).map((r) => {
      const view = chatView(r)
      return {
        id: view.id,
        title: view.title,
        documentId: view.documentId,
        mode: view.mode,
        messageCount: view.messages.length,
        lastMessage: view.messages[view.messages.length - 1]?.content.slice(0, 140) ?? '',
        updatedAt: view.updatedAt,
      }
    }),
  })
})

chatRoutes.post('/', async (c) => {
  const body = await readJson(c)
  const userId = c.get('userId')
  const documentId = optionalStr(body.documentId, 'Document', 80) ?? null
  if (documentId) await getOwnedDocument(c.env, userId, documentId)
  const now = nowIso()
  const row: ChatRow = {
    id: newId('chat'),
    user_id: userId,
    document_id: documentId,
    title: str(body.title ?? 'New chat', 'Title', { max: 120 }),
    messages: '[]',
    mode: 'simple',
    created_at: now,
    updated_at: now,
  }
  await c.env.DB.prepare(
    'INSERT INTO chats (id, user_id, document_id, title, messages, mode, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(row.id, row.user_id, row.document_id, row.title, row.messages, row.mode, row.created_at, row.updated_at)
    .run()
  return c.json({ chat: chatView(row) }, 201)
})

chatRoutes.get('/:id', async (c) => {
  const row = await ownedChat(c.env, c.get('userId'), c.req.param('id'))
  return c.json({ chat: chatView(row) })
})

chatRoutes.delete('/:id', async (c) => {
  const row = await ownedChat(c.env, c.get('userId'), c.req.param('id'))
  await c.env.DB.prepare('DELETE FROM chats WHERE id = ? AND user_id = ?').bind(row.id, row.user_id).run()
  return c.json({ ok: true })
})

chatRoutes.delete('/:id/messages', async (c) => {
  const row = await ownedChat(c.env, c.get('userId'), c.req.param('id'))
  await c.env.DB.prepare('UPDATE chats SET messages = ?, updated_at = ? WHERE id = ? AND user_id = ?')
    .bind('[]', nowIso(), row.id, row.user_id)
    .run()
  return c.json({ ok: true })
})
