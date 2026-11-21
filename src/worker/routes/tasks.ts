import { Hono } from 'hono'

import { newId, nowIso } from '../db'
import { optionalStr, readJson, str } from '../middleware'
import { ApiError, type AppEnv } from '../types'

type TaskRow = {
  id: string
  user_id: string
  subject: string
  topic: string | null
  title: string
  due_date: string | null
  completed: number
  created_at: string
}

function view(row: TaskRow) {
  return {
    id: row.id,
    subject: row.subject,
    topic: row.topic ?? '',
    title: row.title,
    dueDate: row.due_date,
    completed: row.completed === 1,
    createdAt: row.created_at,
  }
}

async function ownedTask(env: AppEnv['Bindings'], userId: string, id: string): Promise<TaskRow> {
  const row = await env.DB.prepare('SELECT * FROM study_tasks WHERE id = ? AND user_id = ?').bind(id, userId).first<TaskRow>()
  if (!row) throw new ApiError(404, 'Task not found.')
  return row
}

function validDate(value: string | undefined): string | null {
  if (!value) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ApiError(400, 'Due date must be a valid date.')
  return value
}

export const taskRoutes = new Hono<AppEnv>()

taskRoutes.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM study_tasks WHERE user_id = ? ORDER BY completed ASC, due_date IS NULL, due_date ASC, created_at DESC',
  )
    .bind(c.get('userId'))
    .all<TaskRow>()
  return c.json({ tasks: (results ?? []).map(view) })
})

taskRoutes.post('/', async (c) => {
  const body = await readJson(c)
  const row: TaskRow = {
    id: newId('task'),
    user_id: c.get('userId'),
    subject: str(body.subject, 'Subject', { max: 80 }),
    topic: optionalStr(body.topic, 'Topic', 120) ?? null,
    title: str(body.title, 'Task title', { max: 200 }),
    due_date: validDate(optionalStr(body.dueDate, 'Due date', 10)),
    completed: 0,
    created_at: nowIso(),
  }
  await c.env.DB.prepare(
    'INSERT INTO study_tasks (id, user_id, subject, topic, title, due_date, completed, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)',
  )
    .bind(row.id, row.user_id, row.subject, row.topic, row.title, row.due_date, row.created_at)
    .run()
  return c.json({ task: view(row) }, 201)
})

taskRoutes.put('/:id', async (c) => {
  const task = await ownedTask(c.env, c.get('userId'), c.req.param('id'))
  const body = await readJson(c)
  const title = body.title === undefined ? task.title : str(body.title, 'Task title', { max: 200 })
  const subject = body.subject === undefined ? task.subject : str(body.subject, 'Subject', { max: 80 })
  const topic = body.topic === undefined ? task.topic : (optionalStr(body.topic, 'Topic', 120) ?? null)
  const dueDate = body.dueDate === undefined ? task.due_date : validDate(optionalStr(body.dueDate, 'Due date', 10))
  const completed = body.completed === undefined ? task.completed === 1 : Boolean(body.completed)

  await c.env.DB.prepare(
    'UPDATE study_tasks SET title = ?, subject = ?, topic = ?, due_date = ?, completed = ? WHERE id = ? AND user_id = ?',
  )
    .bind(title, subject, topic, dueDate, completed ? 1 : 0, task.id, task.user_id)
    .run()

  if (completed && !task.completed) {
    await c.env.DB.prepare(
      'INSERT INTO study_sessions (id, user_id, subject, topic, duration, source, date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
      .bind(newId('ses'), task.user_id, task.subject, task.topic, 25, 'planner', nowIso().slice(0, 10), nowIso())
      .run()
  }

  return c.json({ task: view(await ownedTask(c.env, task.user_id, task.id)) })
})

taskRoutes.delete('/:id', async (c) => {
  const task = await ownedTask(c.env, c.get('userId'), c.req.param('id'))
  await c.env.DB.prepare('DELETE FROM study_tasks WHERE id = ? AND user_id = ?').bind(task.id, task.user_id).run()
  return c.json({ ok: true })
})
