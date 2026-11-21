import { Hono } from 'hono'

import {
  ASSISTANT_CONTEXTS,
  CHAT_MODES,
  NOTE_STYLES,
  chatWithDocument,
  explainConcept,
  generateFlashcards,
  generateNotes,
  generateQuiz,
  generateStudyPlan,
  analyzeDocument,
} from '../ai-tasks'
import { newId, nowIso } from '../db'
import { getOwnedDocument, parseAnalysis } from '../documents'
import { enforceAiRateLimit } from '../gemini'
import { oneOf, optionalStr, readJson, str } from '../middleware'
import { ApiError, type AppEnv } from '../types'
import { chatView, readMessages, ownedChat, type ChatMessage, type ChatRow } from './chats'

export const aiRoutes = new Hono<AppEnv>()

const LANGUAGES = ['english', 'marathi', 'hindi'] as const

async function aiContext(c: Parameters<typeof readJson>[0] & { env: AppEnv['Bindings']; get: (k: 'userId') => string }) {
  await enforceAiRateLimit(c.env, c.get('userId'))
}

aiRoutes.post('/chat', async (c) => {
  const userId = c.get('userId')
  const body = await readJson(c)
  const documentId = str(body.documentId, 'Document', { min: 3, max: 80 })
  const question = str(body.question, 'Question', { min: 2, max: 4000 })
  const mode = oneOf(body.mode, CHAT_MODES, 'Mode', 'simple')
  const language = oneOf(body.language, LANGUAGES, 'Language', 'english')
  const document = await getOwnedDocument(c.env, userId, documentId)
  if (!document.extracted_text.trim()) {
    throw new ApiError(422, 'This document has no readable text, so it cannot be used for chat.')
  }
  await aiContext(c)

  let chat: ChatRow
  const chatId = optionalStr(body.chatId, 'Chat', 80)
  if (chatId) {
    chat = await ownedChat(c.env, userId, chatId)
    if (chat.document_id && chat.document_id !== document.id) {
      throw new ApiError(400, 'This chat belongs to a different document. Start a new chat instead.')
    }
  } else {
    const now = nowIso()
    chat = {
      id: newId('chat'),
      user_id: userId,
      document_id: document.id,
      title: question.slice(0, 80),
      messages: '[]',
      mode,
      created_at: now,
      updated_at: now,
    }
    await c.env.DB.prepare(
      'INSERT INTO chats (id, user_id, document_id, title, messages, mode, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
      .bind(chat.id, chat.user_id, chat.document_id, chat.title, chat.messages, chat.mode, chat.created_at, chat.updated_at)
      .run()
  }

  const history = await readMessages(chat)
  const answer = await chatWithDocument(c.env, {
    text: document.extracted_text,
    question,
    history: history.map((m) => ({ role: m.role, content: m.content })),
    mode,
    language,
    documentName: document.filename,
  })

  const now = nowIso()
  const messages: ChatMessage[] = [
    ...history,
    { id: newId('msg'), role: 'user', content: question, at: now },
    {
      id: newId('msg'),
      role: 'assistant',
      content: answer.answer,
      at: now,
      inDocument: answer.inDocument,
      sources: answer.sources,
    },
  ]
  const title = history.length === 0 ? question.slice(0, 80) : chat.title
  await c.env.DB.prepare('UPDATE chats SET messages = ?, mode = ?, title = ?, updated_at = ? WHERE id = ? AND user_id = ?')
    .bind(JSON.stringify(messages), mode, title, now, chat.id, userId)
    .run()

  await c.env.DB.prepare(
    'INSERT INTO study_sessions (id, user_id, subject, topic, duration, source, date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(newId('ses'), userId, 'Chat', document.filename, 3, 'chat', now.slice(0, 10), now)
    .run()

  const updated = await ownedChat(c.env, userId, chat.id)
  return c.json({ chat: chatView(updated), answer: messages[messages.length - 1] })
})

aiRoutes.post('/summarize', async (c) => {
  const userId = c.get('userId')
  const body = await readJson(c)
  const documentId = str(body.documentId, 'Document', { min: 3, max: 80 })
  const document = await getOwnedDocument(c.env, userId, documentId)
  if (!document.extracted_text.trim()) {
    throw new ApiError(422, 'This document has no readable text to summarise (scanned PDFs need OCR, which is unavailable).')
  }
  const existing = parseAnalysis(document.summary_json)
  if (existing && body.force !== true) return c.json({ analysis: existing, cached: true })
  await aiContext(c)
  const analysis = await analyzeDocument(c.env, document.extracted_text)
  await c.env.DB.prepare('UPDATE documents SET summary_json = ? WHERE id = ? AND user_id = ?')
    .bind(JSON.stringify(analysis), document.id, userId)
    .run()
  return c.json({ analysis, cached: false })
})

aiRoutes.post('/generate-notes', async (c) => {
  const userId = c.get('userId')
  const body = await readJson(c)
  const documentId = str(body.documentId, 'Document', { min: 3, max: 80 })
  const style = oneOf(body.style, NOTE_STYLES, 'Style', 'detailed')
  const language = oneOf(body.language, LANGUAGES, 'Language', 'english')
  const focus = optionalStr(body.focus, 'Focus', 300)
  const document = await getOwnedDocument(c.env, userId, documentId)
  if (!document.extracted_text.trim()) throw new ApiError(422, 'This document has no readable text to take notes from.')
  await aiContext(c)
  const notes = await generateNotes(c.env, document.extracted_text, { style, language, focus })
  return c.json({ title: notes.title, content: notes.content, style, language, documentId: document.id })
})

aiRoutes.post('/generate-quiz', async (c) => {
  const userId = c.get('userId')
  const body = await readJson(c)
  const documentId = str(body.documentId, 'Document', { min: 3, max: 80 })
  const count = Math.min(Math.max(Math.round(Number(body.count) || 10), 3), 20)
  const difficulty = oneOf(body.difficulty, ['easy', 'medium', 'hard'] as const, 'Difficulty', 'medium')
  const type = oneOf(body.type, ['mcq', 'tf', 'mixed'] as const, 'Question type', 'mcq')
  const language = oneOf(body.language, LANGUAGES, 'Language', 'english')
  const focus = optionalStr(body.focus, 'Focus', 300)
  const document = await getOwnedDocument(c.env, userId, documentId)
  if (!document.extracted_text.trim()) throw new ApiError(422, 'This document has no readable text to build a quiz from.')
  await aiContext(c)

  const quiz = await generateQuiz(c.env, document.extracted_text, { count, difficulty, type, language, focus })
  const id = newId('quiz')
  await c.env.DB.prepare(
    `INSERT INTO quizzes (id, user_id, document_id, title, questions, answers, score, total_questions, difficulty, weak_topics, time_taken, created_at, completed_at)
     VALUES (?, ?, ?, ?, ?, NULL, 0, ?, ?, NULL, NULL, ?, NULL)`,
  )
    .bind(id, userId, document.id, quiz.title, JSON.stringify(quiz.questions), quiz.questions.length, difficulty, nowIso())
    .run()

  return c.json(
    {
      quizId: id,
      title: quiz.title,
      difficulty,
      totalQuestions: quiz.questions.length,
      questions: quiz.questions.map((q) => ({ id: q.id, question: q.question, options: q.options, topic: q.topic })),
    },
    201,
  )
})

aiRoutes.post('/generate-flashcards', async (c) => {
  const userId = c.get('userId')
  const body = await readJson(c)
  const documentId = str(body.documentId, 'Document', { min: 3, max: 80 })
  const count = Math.min(Math.max(Math.round(Number(body.count) || 10), 4), 30)
  const chapter = optionalStr(body.chapter, 'Chapter', 160)
  const language = oneOf(body.language, LANGUAGES, 'Language', 'english')
  const document = await getOwnedDocument(c.env, userId, documentId)
  if (!document.extracted_text.trim()) throw new ApiError(422, 'This document has no readable text to build flashcards from.')
  await aiContext(c)
  const deck = await generateFlashcards(c.env, document.extracted_text, { count, chapter, language })
  return c.json({ title: deck.title, cards: deck.cards, documentId: document.id })
})

aiRoutes.post('/explain', async (c) => {
  const userId = c.get('userId')
  const body = await readJson(c)
  const prompt = str(body.prompt, 'Question', { min: 2, max: 6000 })
  const context = oneOf(body.context, ASSISTANT_CONTEXTS, 'Context', 'general')
  const mode = oneOf(body.mode, CHAT_MODES, 'Mode', 'simple')
  const language = oneOf(body.language, LANGUAGES, 'Language', 'english')
  const history = Array.isArray(body.history)
    ? (body.history as { role?: unknown; content?: unknown }[])
        .map((h) => ({
          role: h.role === 'assistant' ? ('assistant' as const) : ('user' as const),
          content: typeof h.content === 'string' ? h.content.slice(0, 4000) : '',
        }))
        .filter((h) => h.content)
    : []

  let contextText = ''
  if (context === 'document') {
    const documentId = str(body.documentId, 'Document', { min: 3, max: 80 })
    const document = await getOwnedDocument(c.env, userId, documentId)
    if (!document.extracted_text.trim()) throw new ApiError(422, 'This document has no readable text.')
    contextText = `Document: ${document.filename}\n\n${document.extracted_text}`
  } else if (context === 'subject') {
    const subject = str(body.subject, 'Subject', { min: 2, max: 120 })
    const { results } = await c.env.DB.prepare(
      'SELECT title, content FROM notes WHERE user_id = ? ORDER BY updated_at DESC LIMIT 5',
    )
      .bind(userId)
      .all<{ title: string; content: string }>()
    const notes = (results ?? []).map((n) => `# ${n.title}\n${n.content.slice(0, 3000)}`).join('\n\n')
    contextText = `Subject: ${subject}\nThe student's saved notes on related material:\n${notes || '(none saved yet)'}`
  }
  await aiContext(c)
  const answer = await explainConcept(c.env, { prompt, context, contextText, mode, language, history })
  return c.json({ answer })
})

aiRoutes.post('/generate-plan', async (c) => {
  const userId = c.get('userId')
  const body = await readJson(c)
  const subjects = Array.isArray(body.subjects)
    ? body.subjects.map((s) => String(s).trim()).filter(Boolean).slice(0, 12)
    : []
  const topics = Array.isArray(body.topics) ? body.topics.map((s) => String(s).trim()).filter(Boolean).slice(0, 40) : []
  if (!subjects.length) throw new ApiError(400, 'Add at least one subject.')
  const examDate = str(body.examDate, 'Exam date', { min: 10, max: 10 })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(examDate) || examDate <= nowIso().slice(0, 10)) {
    throw new ApiError(400, 'Exam date must be a future date in YYYY-MM-DD format.')
  }
  const dailyMinutes = Math.min(Math.max(Math.round(Number(body.dailyMinutes) || 60), 15), 600)
  const language = oneOf(body.language, LANGUAGES, 'Language', 'english')
  await aiContext(c)

  const plan = await generateStudyPlan(c.env, { subjects, examDate, dailyMinutes, topics, language })
  if (!plan.tasks.length) throw new ApiError(422, 'The planner could not fit the topics before the exam date. Add more time or move the date.')

  const values: string[] = []
  const ids: string[] = []
  for (const task of plan.tasks) {
    const id = newId('task')
    ids.push(id)
    values.push(
      `('${id}', '${userId}', ${sqlString(task.subject)}, ${sqlString(task.topic)}, ${sqlString(task.title)}, '${task.dueDate}', 0, '${nowIso()}')`,
    )
  }
  await c.env.DB.prepare(
    `INSERT INTO study_tasks (id, user_id, subject, topic, title, due_date, completed, created_at) VALUES ${values.join(', ')}`,
  ).run()

  return c.json({ created: ids.length, note: plan.note, tasks: plan.tasks }, 201)
})

/** Minimal SQL literal escaping for the batch insert above (all values are AI text). */
function sqlString(value: string): string {
  return `'${String(value).replace(/'/g, "''").slice(0, 300)}'`
}
