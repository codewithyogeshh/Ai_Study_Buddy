import { Hono } from 'hono'

import { newId, nowIso } from '../db'
import { readJson, str } from '../middleware'
import { ApiError, type AppEnv } from '../types'

type DeckRow = {
  id: string
  user_id: string
  document_id: string | null
  title: string
  cards: string
  created_at: string
}

type Card = { id: string; front: string; back: string; topic: string; confidence?: 'easy' | 'hard' }

function view(row: DeckRow) {
  let cards: Card[] = []
  try {
    cards = JSON.parse(row.cards) as Card[]
  } catch {
    cards = []
  }
  return {
    id: row.id,
    documentId: row.document_id,
    title: row.title,
    cards,
    createdAt: row.created_at,
  }
}

async function ownedDeck(env: AppEnv['Bindings'], userId: string, id: string): Promise<DeckRow> {
  const row = await env.DB.prepare('SELECT * FROM flashcards WHERE id = ? AND user_id = ?').bind(id, userId).first<DeckRow>()
  if (!row) throw new ApiError(404, 'Flashcard set not found.')
  return row
}

export const flashcardRoutes = new Hono<AppEnv>()

flashcardRoutes.get('/', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM flashcards WHERE user_id = ? ORDER BY created_at DESC')
    .bind(c.get('userId'))
    .all<DeckRow>()
  return c.json({ decks: (results ?? []).map(view) })
})

flashcardRoutes.get('/:id', async (c) => {
  return c.json({ deck: view(await ownedDeck(c.env, c.get('userId'), c.req.param('id'))) })
})

/** Saves an AI-generated deck (or a student's own cards). */
flashcardRoutes.post('/', async (c) => {
  const body = await readJson(c)
  const cards = Array.isArray(body.cards) ? body.cards : []
  const clean = cards
    .map((raw, i) => {
      const card = (raw ?? {}) as Record<string, unknown>
      const front = typeof card.front === 'string' ? card.front.trim() : ''
      const back = typeof card.back === 'string' ? card.back.trim() : ''
      if (!front || !back) return null
      return {
        id: typeof card.id === 'string' && card.id ? card.id : `c_${i}_${Math.random().toString(36).slice(2, 8)}`,
        front: front.slice(0, 600),
        back: back.slice(0, 2000),
        topic: typeof card.topic === 'string' ? card.topic.slice(0, 120) : 'General',
      }
    })
    .filter((c2): c2 is Card => Boolean(c2))
  if (!clean.length) throw new ApiError(400, 'A flashcard set needs at least one card.')
  if (clean.length > 60) throw new ApiError(400, 'A flashcard set can hold at most 60 cards.')

  const row: DeckRow = {
    id: newId('deck'),
    user_id: c.get('userId'),
    document_id: typeof body.documentId === 'string' ? body.documentId : null,
    title: str(body.title ?? 'Flashcards', 'Title', { max: 160 }),
    cards: JSON.stringify(clean),
    created_at: nowIso(),
  }
  await c.env.DB.prepare(
    'INSERT INTO flashcards (id, user_id, document_id, title, cards, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  )
    .bind(row.id, row.user_id, row.document_id, row.title, row.cards, row.created_at)
    .run()
  return c.json({ deck: view(row) }, 201)
})

/** Persist which cards the student found easy or hard. */
flashcardRoutes.put('/:id', async (c) => {
  const deck = await ownedDeck(c.env, c.get('userId'), c.req.param('id'))
  const body = await readJson(c)
  const updates = Array.isArray(body.cards) ? body.cards : []
  const current = JSON.parse(deck.cards) as Card[]
  for (const update of updates) {
    const u = (update ?? {}) as Record<string, unknown>
    const card = current.find((card2) => card2.id === u.id)
    if (card && (u.confidence === 'easy' || u.confidence === 'hard')) card.confidence = u.confidence
  }
  await c.env.DB.prepare('UPDATE flashcards SET cards = ? WHERE id = ? AND user_id = ?')
    .bind(JSON.stringify(current), deck.id, deck.user_id)
    .run()
  return c.json({ deck: view(deck) })
})

flashcardRoutes.delete('/:id', async (c) => {
  const deck = await ownedDeck(c.env, c.get('userId'), c.req.param('id'))
  await c.env.DB.prepare('DELETE FROM flashcards WHERE id = ? AND user_id = ?').bind(deck.id, deck.user_id).run()
  return c.json({ ok: true })
})
