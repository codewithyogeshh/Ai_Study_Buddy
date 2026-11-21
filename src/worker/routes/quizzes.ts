import { Hono } from 'hono'

import { newId, nowIso } from '../db'
import { gradeQuiz, type GradableQuestion, type SubmittedAnswer } from '../scoring'
import { readJson } from '../middleware'
import { ApiError, type AppEnv } from '../types'

type QuizRow = {
  id: string
  user_id: string
  document_id: string | null
  title: string
  questions: string
  answers: string | null
  score: number
  total_questions: number
  difficulty: string
  weak_topics: string | null
  time_taken: number | null
  created_at: string
  completed_at: string | null
}

function parseQuestions(row: QuizRow): GradableQuestion[] {
  try {
    const parsed = JSON.parse(row.questions)
    return Array.isArray(parsed) ? (parsed as GradableQuestion[]) : []
  } catch {
    return []
  }
}

/** Answers and correct options are stripped until the quiz is submitted. */
function quizView(row: QuizRow) {
  const completed = Boolean(row.completed_at)
  const questions = parseQuestions(row).map((q) => ({
    id: q.id,
    question: q.question,
    options: q.options,
    topic: q.topic,
    ...(completed ? { correctIndex: q.answerIndex, explanation: q.explanation } : {}),
  }))
  return {
    id: row.id,
    documentId: row.document_id,
    title: row.title,
    difficulty: row.difficulty,
    totalQuestions: row.total_questions,
    score: row.score,
    completed,
    completedAt: row.completed_at,
    timeTaken: row.time_taken,
    weakTopics: row.weak_topics ? (JSON.parse(row.weak_topics) as string[]) : [],
    createdAt: row.created_at,
    questions,
    ...(completed && row.answers ? { result: JSON.parse(row.answers) } : {}),
  }
}

async function ownedQuiz(env: AppEnv['Bindings'], userId: string, id: string): Promise<QuizRow> {
  const row = await env.DB.prepare('SELECT * FROM quizzes WHERE id = ? AND user_id = ?').bind(id, userId).first<QuizRow>()
  if (!row) throw new ApiError(404, 'Quiz not found.')
  return row
}

export const quizRoutes = new Hono<AppEnv>()

quizRoutes.get('/', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM quizzes WHERE user_id = ? ORDER BY created_at DESC LIMIT 100')
    .bind(c.get('userId'))
    .all<QuizRow>()
  return c.json({
    quizzes: (results ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      documentId: row.document_id,
      difficulty: row.difficulty,
      totalQuestions: row.total_questions,
      score: row.score,
      completed: Boolean(row.completed_at),
      completedAt: row.completed_at,
      createdAt: row.created_at,
    })),
  })
})

quizRoutes.get('/:id', async (c) => {
  return c.json({ quiz: quizView(await ownedQuiz(c.env, c.get('userId'), c.req.param('id'))) })
})

quizRoutes.post('/:id/submit', async (c) => {
  const row = await ownedQuiz(c.env, c.get('userId'), c.req.param('id'))
  if (row.completed_at) throw new ApiError(409, 'This quiz has already been submitted.')
  const body = await readJson(c)
  const rawAnswers = Array.isArray(body.answers) ? body.answers : []
  const answers: SubmittedAnswer[] = rawAnswers.map((a) => {
    const item = (a ?? {}) as Record<string, unknown>
    return {
      questionId: typeof item.questionId === 'string' ? item.questionId : '',
      selectedIndex: typeof item.selectedIndex === 'number' ? item.selectedIndex : null,
    }
  })
  const timeTaken = Math.max(0, Math.min(86_400, Math.round(Number(body.timeTaken) || 0)))
  const questions = parseQuestions(row)
  if (!questions.length) throw new ApiError(422, 'This quiz has no questions to grade.')

  const result = gradeQuiz(questions, answers)
  const completedAt = nowIso()
  await c.env.DB.prepare(
    'UPDATE quizzes SET answers = ?, score = ?, weak_topics = ?, time_taken = ?, completed_at = ? WHERE id = ? AND user_id = ?',
  )
    .bind(JSON.stringify(result), result.score, JSON.stringify(result.weakTopics), timeTaken, completedAt, row.id, row.user_id)
    .run()

  if (timeTaken > 0) {
    await c.env.DB.prepare(
      'INSERT INTO study_sessions (id, user_id, subject, topic, duration, source, date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
      .bind(newId('ses'), row.user_id, 'Quiz', row.title, Math.round(timeTaken / 60), 'quiz', completedAt.slice(0, 10), completedAt)
      .run()
  }

  return c.json({ result, quiz: quizView(await ownedQuiz(c.env, row.user_id, row.id)) })
})

quizRoutes.delete('/:id', async (c) => {
  const row = await ownedQuiz(c.env, c.get('userId'), c.req.param('id'))
  await c.env.DB.prepare('DELETE FROM quizzes WHERE id = ? AND user_id = ?').bind(row.id, row.user_id).run()
  return c.json({ ok: true })
})
