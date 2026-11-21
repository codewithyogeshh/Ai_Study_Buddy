import { Hono } from 'hono'

import type { AppEnv } from '../types'

type CountRow = { n: number }

function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

function lastDays(days: number): string[] {
  const out: string[] = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000)
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

function safeJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export const analyticsRoutes = new Hono<AppEnv>()

analyticsRoutes.get('/dashboard', async (c) => {
  const userId = c.get('userId')
  const db = c.env.DB

  const [docCount, quizAgg, noteCount, deckCount, taskAgg, sessionAgg] = await Promise.all([
    db.prepare('SELECT COUNT(*) AS n FROM documents WHERE user_id = ?').bind(userId).first<CountRow>(),
    db
      .prepare(
        'SELECT COUNT(*) AS n, COALESCE(AVG(score * 100.0 / NULLIF(total_questions,0)), 0) AS avg FROM quizzes WHERE user_id = ? AND completed_at IS NOT NULL',
      )
      .bind(userId)
      .first<{ n: number; avg: number }>(),
    db.prepare('SELECT COUNT(*) AS n FROM notes WHERE user_id = ?').bind(userId).first<CountRow>(),
    db.prepare('SELECT COUNT(*) AS n FROM flashcards WHERE user_id = ?').bind(userId).first<CountRow>(),
    db
      .prepare('SELECT COUNT(*) AS total, COALESCE(SUM(completed),0) AS done FROM study_tasks WHERE user_id = ?')
      .bind(userId)
      .first<{ total: number; done: number }>(),
    db
      .prepare('SELECT COALESCE(SUM(duration),0) AS minutes, COUNT(*) AS sessions FROM study_sessions WHERE user_id = ?')
      .bind(userId)
      .first<{ minutes: number; sessions: number }>(),
  ])

  const recentDocuments = await db
    .prepare('SELECT * FROM documents WHERE user_id = ? ORDER BY upload_date DESC LIMIT 5')
    .bind(userId)
    .all()

  const recentQuizzes = await db
    .prepare('SELECT id, title, score, total_questions, completed_at, created_at FROM quizzes WHERE user_id = ? ORDER BY created_at DESC LIMIT 5')
    .bind(userId)
    .all()

  const upcomingTasks = await db
    .prepare(
      'SELECT * FROM study_tasks WHERE user_id = ? AND completed = 0 ORDER BY due_date IS NULL, due_date ASC LIMIT 6',
    )
    .bind(userId)
    .all()

  const sessions = await db
    .prepare('SELECT date, duration, topic, source FROM study_sessions WHERE user_id = ? AND date >= ?')
    .bind(userId, lastDays(14)[0])
    .all<{ date: string; duration: number; topic: string | null; source: string | null }>()

  const completedQuizzes = await db
    .prepare(
      'SELECT title, score, total_questions, completed_at, weak_topics FROM quizzes WHERE user_id = ? AND completed_at IS NOT NULL ORDER BY completed_at DESC LIMIT 30',
    )
    .bind(userId)
    .all<{ title: string; score: number; total_questions: number; completed_at: string; weak_topics: string | null }>()

  const days = lastDays(14)
  const activity = days.map((date) => {
    const daySessions = (sessions.results ?? []).filter((s) => s.date === date)
    return {
      date,
      minutes: daySessions.reduce((sum, s) => sum + (s.duration || 0), 0),
      sessions: daySessions.length,
      quizzes: (completedQuizzes.results ?? []).filter((q) => dayKey(q.completed_at) === date).length,
    }
  })

  const activeDays = new Set(activity.filter((a) => a.sessions > 0 || a.quizzes > 0).map((a) => a.date))
  let streak = 0
  const today = lastDays(1)[0]
  for (let i = 13; i >= 0; i--) {
    const key = days[i]
    if (activeDays.has(key)) streak++
    else if (key !== today) break
    else continue
  }

  const topicCounts = new Map<string, number>()
  for (const s of sessions.results ?? []) {
    if (!s.topic) continue
    topicCounts.set(s.topic, (topicCounts.get(s.topic) ?? 0) + 1)
  }
  const frequentTopics = [...topicCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([topic, count]) => ({ topic, count }))

  const weakTopicCounts = new Map<string, number>()
  for (const q of completedQuizzes.results ?? []) {
    for (const topic of safeJson<string[]>(q.weak_topics, [])) {
      weakTopicCounts.set(topic, (weakTopicCounts.get(topic) ?? 0) + 1)
    }
  }
  const weakTopics = [...weakTopicCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([topic, count]) => ({ topic, count }))

  return c.json({
    stats: {
      documents: docCount?.n ?? 0,
      quizzesCompleted: quizAgg?.n ?? 0,
      averageScore: Math.round(quizAgg?.avg ?? 0),
      notes: noteCount?.n ?? 0,
      flashcardDecks: deckCount?.n ?? 0,
      tasksTotal: taskAgg?.total ?? 0,
      tasksCompleted: taskAgg?.done ?? 0,
      studyMinutes: sessionAgg?.minutes ?? 0,
      studySessions: sessionAgg?.sessions ?? 0,
      studyStreak: streak,
    },
    recentDocuments: (recentDocuments.results ?? []).map((r) => {
      const row = r as Record<string, unknown>
      return {
        id: row.id,
        filename: row.filename,
        fileType: row.file_type,
        pageCount: row.page_count,
        uploadDate: row.upload_date,
        processingStatus: row.processing_status,
        hasAnalysis: Boolean(row.summary_json),
      }
    }),
    recentQuizzes: (recentQuizzes.results ?? []).map((r) => {
      const row = r as unknown as { id: string; title: string; score: number; total_questions: number; completed_at: string | null; created_at: string }
      return {
        id: row.id,
        title: row.title,
        score: row.score,
        totalQuestions: row.total_questions,
        percentage: row.total_questions ? Math.round((row.score / row.total_questions) * 100) : 0,
        completed: Boolean(row.completed_at),
        completedAt: row.completed_at,
        createdAt: row.created_at,
      }
    }),
    upcomingTasks: (upcomingTasks.results ?? []).map((r) => {
      const row = r as Record<string, unknown>
      return {
        id: row.id,
        title: row.title,
        subject: row.subject,
        topic: row.topic,
        dueDate: row.due_date,
        completed: row.completed === 1,
      }
    }),
    activity,
    frequentTopics,
    weakTopics,
  })
})

analyticsRoutes.get('/progress', async (c) => {
  const userId = c.get('userId')
  const db = c.env.DB

  const quizzes = await db
    .prepare(
      'SELECT id, title, score, total_questions, completed_at, answers, weak_topics FROM quizzes WHERE user_id = ? AND completed_at IS NOT NULL ORDER BY completed_at ASC LIMIT 200',
    )
    .bind(userId)
    .all<{
      id: string
      title: string
      score: number
      total_questions: number
      completed_at: string
      answers: string | null
      weak_topics: string | null
    }>()

  const taskAgg = await db
    .prepare('SELECT COUNT(*) AS total, COALESCE(SUM(completed),0) AS done FROM study_tasks WHERE user_id = ?')
    .bind(userId)
    .first<{ total: number; done: number }>()

  const documentAgg = await db
    .prepare('SELECT COUNT(*) AS n, COALESCE(SUM(page_count),0) AS pages FROM documents WHERE user_id = ?')
    .bind(userId)
    .first<{ n: number; pages: number }>()

  const sessions = await db
    .prepare('SELECT date, duration, topic, source FROM study_sessions WHERE user_id = ? AND date >= ?')
    .bind(userId, lastDays(30)[0])
    .all<{ date: string; duration: number; topic: string | null; source: string | null }>()

  const days = lastDays(30)
  const activity = days.map((date) => {
    const daySessions = (sessions.results ?? []).filter((s) => s.date === date)
    return {
      date,
      minutes: daySessions.reduce((sum, s) => sum + (s.duration || 0), 0),
      sessions: daySessions.length,
    }
  })

  const quizHistory = (quizzes.results ?? []).map((q) => ({
    id: q.id,
    title: q.title,
    date: q.completed_at.slice(0, 10),
    percentage: q.total_questions ? Math.round((q.score / q.total_questions) * 100) : 0,
    score: q.score,
    total: q.total_questions,
  }))

  const topicStats = new Map<string, { correct: number; total: number }>()
  for (const quiz of quizzes.results ?? []) {
    const result = safeJson<{ graded?: { topic: string; correct: boolean }[] }>(quiz.answers, {})
    for (const item of result.graded ?? []) {
      const key = item.topic || 'General'
      const existing = topicStats.get(key) ?? { correct: 0, total: 0 }
      existing.total += 1
      if (item.correct) existing.correct += 1
      topicStats.set(key, existing)
    }
  }
  const topics = [...topicStats.entries()]
    .map(([topic, s]) => ({ topic, correct: s.correct, total: s.total, percentage: Math.round((s.correct / s.total) * 100) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 12)

  const weakTopicCounts = new Map<string, number>()
  for (const quiz of quizzes.results ?? []) {
    for (const topic of safeJson<string[]>(quiz.weak_topics, [])) {
      weakTopicCounts.set(topic, (weakTopicCounts.get(topic) ?? 0) + 1)
    }
  }
  const subjectCounts = new Map<string, number>()
  for (const s of sessions.results ?? []) {
    const key = s.source ?? 'study'
    subjectCounts.set(key, (subjectCounts.get(key) ?? 0) + 1)
  }

  const completed = quizzes.results ?? []
  return c.json({
    totals: {
      quizzes: completed.length,
      averageScore: completed.length
        ? Math.round(completed.reduce((sum, q) => sum + (q.total_questions ? (q.score / q.total_questions) * 100 : 0), 0) / completed.length)
        : 0,
      bestScore: completed.length
        ? Math.max(...completed.map((q) => (q.total_questions ? Math.round((q.score / q.total_questions) * 100) : 0)))
        : 0,
      tasksCompleted: taskAgg?.done ?? 0,
      tasksTotal: taskAgg?.total ?? 0,
      documents: documentAgg?.n ?? 0,
      pagesRead: documentAgg?.pages ?? 0,
      studyMinutes: (sessions.results ?? []).reduce((sum, s) => sum + (s.duration || 0), 0),
    },
    quizHistory,
    topics,
    weakTopics: [...weakTopicCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([topic, count]) => ({ topic, count })),
    activity,
    bySource: [...subjectCounts.entries()].map(([source, count]) => ({ source, count })),
  })
})
