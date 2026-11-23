import { Hono } from 'hono'

import { evaluateVivaAnswer, generateVivaQuestions, type VivaEvaluation, type VivaQuestion } from '../ai-tasks'
import { newId, nowIso } from '../db'
import { getOwnedDocument } from '../documents'
import { enforceAiRateLimit } from '../gemini'
import { oneOf, optionalStr, readJson, str } from '../middleware'
import { ApiError, type AppEnv } from '../types'

type VivaRow = {
  id: string
  user_id: string
  subject: string
  topic: string
  difficulty: string
  questions: string
  evaluations: string
  score: number | null
  total: number | null
  created_at: string
  completed_at: string | null
}

type StoredEvaluation = VivaEvaluation & { questionId: string; question: string; answer: string; at: string }

function parse<T>(json: string, fallback: T): T {
  try {
    const value = JSON.parse(json)
    return (Array.isArray(value) ? value : fallback) as T
  } catch {
    return fallback
  }
}

function view(row: VivaRow) {
  const questions = parse<VivaQuestion[]>(row.questions, [])
  const evaluations = parse<StoredEvaluation[]>(row.evaluations, [])
  return {
    id: row.id,
    subject: row.subject,
    topic: row.topic,
    difficulty: row.difficulty,
    questions,
    evaluations,
    score: row.score,
    total: row.total,
    completed: Boolean(row.completed_at),
    completedAt: row.completed_at,
    createdAt: row.created_at,
    nextIndex: evaluations.length,
  }
}

async function ownedViva(env: AppEnv['Bindings'], userId: string, id: string): Promise<VivaRow> {
  const row = await env.DB.prepare('SELECT * FROM viva_sessions WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .first<VivaRow>()
  if (!row) throw new ApiError(404, 'Viva session not found.')
  return row
}

/** Aggregated locally so the summary still works if the AI call fails. */
function buildSummary(evaluations: StoredEvaluation[], questions: VivaQuestion[]) {
  if (!evaluations.length) {
    return { averageScore: 0, strengths: [], weakTopics: [], practiceAgain: [], verdict: 'No answers were submitted.' }
  }
  const average = evaluations.reduce((sum, e) => sum + e.score, 0) / evaluations.length
  const strengths = [...new Set(evaluations.filter((e) => e.score >= 7).map((e) => e.question))]
  const weakTopics = [...new Set(evaluations.filter((e) => e.score < 6).map((e) => e.question))]
  const practiceAgain = evaluations
    .filter((e) => e.score < 7)
    .sort((a, b) => a.score - b.score)
    .slice(0, 5)
    .map((e) => e.question)
  const verdict =
    average >= 8
      ? 'Excellent — you can defend this topic confidently in an oral exam.'
      : average >= 6
        ? 'Solid understanding. Tighten the weaker answers and you are exam-ready.'
        : average >= 4
          ? 'You know the basics but your answers are incomplete. Revise the missed points.'
          : 'This topic needs a full revision pass before the viva.'
  return {
    averageScore: Math.round(average * 10) / 10,
    strengths: strengths.slice(0, 6),
    weakTopics: weakTopics.slice(0, 8),
    practiceAgain,
    verdict,
    questionsAsked: questions.length,
  }
}

export const vivaRoutes = new Hono<AppEnv>()

vivaRoutes.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, subject, topic, difficulty, score, total, created_at, completed_at FROM viva_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
  )
    .bind(c.get('userId'))
    .all()
  return c.json({
    sessions: (results ?? []).map((r) => {
      const row = r as unknown as VivaRow
      return {
        id: row.id,
        subject: row.subject,
        topic: row.topic,
        difficulty: row.difficulty,
        score: row.score,
        total: row.total,
        completed: Boolean(row.completed_at),
        createdAt: row.created_at,
      }
    }),
  })
})

vivaRoutes.get('/:id', async (c) => {
  const row = await ownedViva(c.env, c.get('userId'), c.req.param('id'))
  const questions = parse<VivaQuestion[]>(row.questions, [])
  const evaluations = parse<StoredEvaluation[]>(row.evaluations, [])
  return c.json({ session: view(row), summary: row.completed_at ? buildSummary(evaluations, questions) : null })
})

vivaRoutes.delete('/:id', async (c) => {
  const row = await ownedViva(c.env, c.get('userId'), c.req.param('id'))
  // The session logged study time when it was finished; remove that entry too.
  await c.env.DB.prepare("DELETE FROM study_sessions WHERE user_id = ? AND source = 'viva' AND subject = ? AND topic = ?")
    .bind(row.user_id, row.subject, row.topic)
    .run()
  await c.env.DB.prepare('DELETE FROM viva_sessions WHERE id = ? AND user_id = ?').bind(row.id, row.user_id).run()
  return c.json({ ok: true })
})

vivaRoutes.post('/start', async (c) => {
  const userId = c.get('userId')
  const body = await readJson(c)
  const subject = str(body.subject, 'Subject', { min: 2, max: 80 })
  const topic = str(body.topic, 'Topic', { min: 2, max: 120 })
  const difficulty = oneOf(body.difficulty, ['easy', 'medium', 'hard'] as const, 'Difficulty', 'medium')
  const count = Math.min(Math.max(Math.round(Number(body.count) || 5), 3), 12)
  const language = oneOf(body.language, ['english', 'marathi', 'hindi'] as const, 'Language', 'english')
  const documentId = optionalStr(body.documentId, 'Document', 80)

  let text: string | undefined
  if (documentId) text = (await getOwnedDocument(c.env, userId, documentId)).extracted_text

  await enforceAiRateLimit(c.env, userId)
  const generated = await generateVivaQuestions(c.env, { subject, topic, difficulty, count, language, text })
  const id = newId('viva')
  await c.env.DB.prepare(
    'INSERT INTO viva_sessions (id, user_id, subject, topic, difficulty, questions, evaluations, score, total, created_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, NULL)',
  )
    .bind(id, userId, subject, topic, difficulty, JSON.stringify(generated.questions), '[]', nowIso())
    .run()
  const row = await ownedViva(c.env, userId, id)
  return c.json({ session: view(row) }, 201)
})

vivaRoutes.post('/:id/answer', async (c) => {
  const userId = c.get('userId')
  const row = await ownedViva(c.env, userId, c.req.param('id'))
  if (row.completed_at) throw new ApiError(409, 'This viva session is already finished.')
  const body = await readJson(c)
  const questionId = str(body.questionId, 'Question', { min: 2, max: 80 })
  const answer = typeof body.answer === 'string' ? body.answer.trim().slice(0, 5000) : ''
  if (!answer) throw new ApiError(400, 'Type or dictate an answer before submitting.')
  const questions = parse<VivaQuestion[]>(row.questions, [])
  const question = questions.find((q) => q.id === questionId)
  if (!question) throw new ApiError(404, 'That question is not part of this session.')
  const evaluations = parse<StoredEvaluation[]>(row.evaluations, [])
  if (evaluations.some((e) => e.questionId === questionId)) {
    throw new ApiError(409, 'That question has already been answered.')
  }

  await enforceAiRateLimit(c.env, userId)
  const evaluation = await evaluateVivaAnswer(c.env, {
    question: question.question,
    answer,
    keywords: question.keywords,
    difficulty: row.difficulty,
    language: 'english',
  })
  const stored: StoredEvaluation = {
    ...evaluation,
    questionId,
    question: question.question,
    answer,
    at: nowIso(),
  }
  await c.env.DB.prepare('UPDATE viva_sessions SET evaluations = ? WHERE id = ? AND user_id = ?')
    .bind(JSON.stringify([...evaluations, stored]), row.id, userId)
    .run()

  const next = questions[evaluations.length + 1]
  return c.json({
    evaluation: stored,
    nextQuestion: next ?? null,
    answeredCount: evaluations.length + 1,
    total: questions.length,
  })
})

vivaRoutes.post('/:id/finish', async (c) => {
  const row = await ownedViva(c.env, c.get('userId'), c.req.param('id'))
  const questions = parse<VivaQuestion[]>(row.questions, [])
  const evaluations = parse<StoredEvaluation[]>(row.evaluations, [])
  if (!evaluations.length) throw new ApiError(422, 'Answer at least one question before finishing.')
  const summary = buildSummary(evaluations, questions)
  const totalScore = evaluations.reduce((sum, e) => sum + e.score, 0)
  const completedAt = nowIso()
  await c.env.DB.prepare('UPDATE viva_sessions SET score = ?, total = ?, completed_at = ? WHERE id = ? AND user_id = ?')
    .bind(totalScore, evaluations.length * 10, completedAt, row.id, row.user_id)
    .run()
  await c.env.DB.prepare(
    'INSERT INTO study_sessions (id, user_id, subject, topic, duration, source, date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(newId('ses'), row.user_id, row.subject, row.topic, evaluations.length * 3, 'viva', completedAt.slice(0, 10), completedAt)
    .run()
  return c.json({ summary, session: view(await ownedViva(c.env, row.user_id, row.id)) })
})
