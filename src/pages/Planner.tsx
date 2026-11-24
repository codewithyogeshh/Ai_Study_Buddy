import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, Check, CheckCircle2, Circle, Plus, Sparkles, Trash2, Wand2 } from 'lucide-react'

import { Button } from '../components/ui/Button'
import { Alert, Badge, Card, EmptyState, PageHeader, Progress, Segmented, Skeleton } from '../components/ui/Card'
import { Input, Label, Select, Textarea } from '../components/ui/Field'
import { Modal } from '../components/ui/Modal'
import { useToast } from '../contexts/ToastContext'
import { useAiStatus } from '../hooks/useAiStatus'
import { api, errorMessage } from '../lib/api'
import { dateInputValue, formatDate } from '../lib/format'
import type { StudyTask } from '../types'

type Filter = 'upcoming' | 'today' | 'completed'

export function Planner() {
  const { success, error: toastError } = useToast()
  const ai = useAiStatus()
  const [tasks, setTasks] = useState<StudyTask[] | null>(null)
  const [filter, setFilter] = useState<Filter>('upcoming')
  const [error, setError] = useState('')

  const [subject, setSubject] = useState('')
  const [topic, setTopic] = useState('')
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState(dateInputValue())
  const [adding, setAdding] = useState(false)

  const [planOpen, setPlanOpen] = useState(false)
  const [planSubjects, setPlanSubjects] = useState('')
  const [planTopics, setPlanTopics] = useState('')
  const [examDate, setExamDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() + 21)
    return date.toISOString().slice(0, 10)
  })
  const [dailyMinutes, setDailyMinutes] = useState(90)
  const [planning, setPlanning] = useState(false)
  const [planNote, setPlanNote] = useState('')

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ tasks: StudyTask[] }>('/tasks')
      setTasks(data.tasks)
      setError('')
    } catch (err) {
      setError(errorMessage(err))
      setTasks([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const today = dateInputValue()
  const counts = useMemo(() => {
    const list = tasks ?? []
    return {
      total: list.length,
      completed: list.filter((task) => task.completed).length,
      today: list.filter((task) => !task.completed && task.dueDate === today).length,
      overdue: list.filter((task) => !task.completed && task.dueDate && task.dueDate < today).length,
    }
  }, [tasks, today])

  const visible = useMemo(() => {
    const list = tasks ?? []
    if (filter === 'completed') return list.filter((task) => task.completed)
    if (filter === 'today') return list.filter((task) => !task.completed && task.dueDate === today)
    return list.filter((task) => !task.completed)
  }, [tasks, filter, today])

  async function addTask(e: React.FormEvent) {
    e.preventDefault()
    if (!subject.trim() || !title.trim()) {
      toastError('A task needs a subject and a title.')
      return
    }
    setAdding(true)
    try {
      const data = await api.post<{ task: StudyTask }>('/tasks', {
        subject: subject.trim(),
        topic: topic.trim() || undefined,
        title: title.trim(),
        dueDate: dueDate || undefined,
      })
      setTasks((list) => [...(list ?? []), data.task].sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999')))
      setTitle('')
      setTopic('')
      success('Task added to your planner.')
    } catch (err) {
      toastError(errorMessage(err))
    } finally {
      setAdding(false)
    }
  }

  async function toggle(task: StudyTask) {
    setTasks((list) => (list ?? []).map((item) => (item.id === task.id ? { ...item, completed: !item.completed } : item)))
    try {
      await api.put(`/tasks/${task.id}`, { completed: !task.completed })
      if (!task.completed) success('Nice — task completed.')
    } catch (err) {
      setTasks((list) => (list ?? []).map((item) => (item.id === task.id ? { ...item, completed: task.completed } : item)))
      toastError(errorMessage(err))
    }
  }

  async function remove(task: StudyTask) {
    try {
      await api.del(`/tasks/${task.id}`)
      setTasks((list) => (list ?? []).filter((item) => item.id !== task.id))
      success('Task removed.')
    } catch (err) {
      toastError(errorMessage(err))
    }
  }

  async function generatePlan() {
    const subjects = planSubjects
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
    if (!subjects.length) {
      toastError('Add at least one subject.')
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(examDate) || examDate <= today) {
      toastError('Choose a future exam date.')
      return
    }
    setPlanning(true)
    setError('')
    try {
      const data = await api.post<{ created: number; note: string }>('/ai/generate-plan', {
        subjects,
        topics: planTopics
          .split('\n')
          .map((item) => item.trim())
          .filter(Boolean),
        examDate,
        dailyMinutes,
        language: 'english',
      })
      setPlanNote(data.note ? `${data.created} tasks added. ${data.note}` : `${data.created} tasks added to your planner.`)
      setPlanOpen(false)
      await load()
      success('Study plan created.')
    } catch (err) {
      setError(errorMessage(err))
      toastError(errorMessage(err))
    } finally {
      setPlanning(false)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Study planner"
        description="Plan realistic sessions, track what is done, and let AI build a schedule around your exam date."
        action={
          <Button variant="secondary" onClick={() => setPlanOpen(true)} icon={<Wand2 className="size-4" />}>
            AI study plan
          </Button>
        }
      />

      {error ? <Alert tone="error">{error}</Alert> : null}
      {planNote ? (
        <Alert tone="success" title="Plan created">
          {planNote}
        </Alert>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total tasks', value: counts.total, tone: 'text-ink' },
          { label: 'Completed', value: counts.completed, tone: 'text-ok' },
          { label: 'Due today', value: counts.today, tone: 'text-primary' },
          { label: 'Overdue', value: counts.overdue, tone: 'text-bad' },
        ].map((stat) => (
          <Card key={stat.label} className="p-4">
            <p className="text-[11.5px] text-muted">{stat.label}</p>
            <p className={`mt-1 text-[22px] font-semibold leading-none tracking-[-0.02em] ${stat.tone}`}>{stat.value}</p>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 text-muted" />
            <p className="text-[12.5px] text-ink-soft">
              {counts.completed} of {counts.total} tasks complete
            </p>
          </div>
          <p className="text-[12px] font-medium text-ink">{counts.total ? Math.round((counts.completed / counts.total) * 100) : 0}%</p>
        </div>
        <Progress value={counts.total ? (counts.completed / counts.total) * 100 : 0} className="mt-2" tone="success" />
      </Card>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <Card className="p-5">
          <h2 className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
            <Plus className="size-4 text-primary" /> Add a task
          </h2>
          <form onSubmit={addTask} className="mt-3.5 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="task-subject">Subject</Label>
                <Input id="task-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Physics" maxLength={80} />
              </div>
              <div>
                <Label htmlFor="task-topic" hint="optional">
                  Topic
                </Label>
                <Input id="task-topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Optics" maxLength={120} />
              </div>
            </div>
            <div>
              <Label htmlFor="task-title">Task</Label>
              <Input
                id="task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Revise lens formula and solve 10 problems"
                maxLength={200}
              />
            </div>
            <div>
              <Label htmlFor="task-date">Target date</Label>
              <Input id="task-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} min={today} />
            </div>
            <Button type="submit" className="w-full" loading={adding} icon={<Plus className="size-4" />}>
              Add task
            </Button>
          </form>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <h2 className="text-[13.5px] font-semibold text-ink">Your tasks</h2>
            <Segmented<Filter>
              value={filter}
              onChange={setFilter}
              size="sm"
              options={[
                { value: 'upcoming', label: 'Upcoming' },
                { value: 'today', label: 'Today' },
                { value: 'completed', label: 'Completed' },
              ]}
            />
          </div>

          {tasks === null ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : visible.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="size-4" />}
              title={filter === 'completed' ? 'No completed tasks yet' : filter === 'today' ? 'Nothing due today' : 'No upcoming tasks'}
              description={
                filter === 'today'
                  ? 'Enjoy the breathing room — or pull a task forward from your upcoming list.'
                  : 'Add a task on the left, or ask the AI to build a plan around your exam date.'
              }
              action={
                filter !== 'today' ? (
                  <Button variant="secondary" onClick={() => setPlanOpen(true)} icon={<Sparkles className="size-4" />}>
                    Generate a study plan
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              {visible.map((task) => {
                const overdue = !task.completed && task.dueDate && task.dueDate < today
                return (
                  <li key={task.id} className="group flex items-start gap-3 px-4 py-3">
                    <button
                      onClick={() => void toggle(task)}
                      className={`mt-0.5 shrink-0 rounded-full transition ${task.completed ? 'text-ok' : 'text-muted hover:text-primary'}`}
                      aria-label={task.completed ? `Mark ${task.title} incomplete` : `Mark ${task.title} complete`}
                    >
                      {task.completed ? <CheckCircle2 className="size-5" /> : <Circle className="size-5" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[13px] font-medium ${task.completed ? 'text-muted line-through' : 'text-ink'}`}>{task.title}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
                        <span>{task.subject}</span>
                        {task.topic ? <span aria-hidden>·</span> : null}
                        {task.topic ? <span>{task.topic}</span> : null}
                        {task.dueDate ? (
                          <>
                            <span aria-hidden>·</span>
                            <span className={overdue ? 'font-medium text-bad' : ''}>{formatDate(task.dueDate)}</span>
                          </>
                        ) : null}
                      </p>
                    </div>
                    {overdue ? <Badge tone="danger">Overdue</Badge> : task.completed ? <Badge tone="success"><Check className="size-3" /> Done</Badge> : null}
                    <button
                      onClick={() => void remove(task)}
                      className="rounded-md p-1.5 text-muted opacity-0 transition hover:bg-bad-soft hover:text-bad group-hover:opacity-100 focus-visible:opacity-100"
                      aria-label={`Delete ${task.title}`}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>

      <Alert tone="info" title="A note on realistic planning">
        The AI planner respects your daily study time and keeps one lighter day each week. Adjust tasks freely — a plan
        you follow beats a perfect plan you abandon.
      </Alert>

      <Modal
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        title="Generate a study plan"
        description="The AI spreads topics across the days before your exam using the time you actually have."
        footer={
          <>
            <Button variant="secondary" onClick={() => setPlanOpen(false)}>
              Cancel
            </Button>
            <Button loading={planning} onClick={() => void generatePlan()} icon={<Sparkles className="size-4" />}>
              Create plan
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          <div>
            <Label htmlFor="plan-subjects">Subjects</Label>
            <Input
              id="plan-subjects"
              value={planSubjects}
              onChange={(e) => setPlanSubjects(e.target.value)}
              placeholder="Physics, Chemistry, Maths"
            />
            <p className="mt-1 text-[11px] text-muted">Separate subjects with commas.</p>
          </div>
          <div>
            <Label htmlFor="plan-topics" hint="optional">
              Topics to cover
            </Label>
            <Textarea
              id="plan-topics"
              value={planTopics}
              onChange={(e) => setPlanTopics(e.target.value)}
              placeholder={'One topic per line, e.g.\nOptics\nThermodynamics\nOrganic chemistry'}
              className="min-h-24 text-[13px]"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="plan-date">Exam date</Label>
              <Input id="plan-date" type="date" value={examDate} min={today} onChange={(e) => setExamDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="plan-minutes">Daily study time</Label>
              <Select id="plan-minutes" value={dailyMinutes} onChange={(e) => setDailyMinutes(Number(e.target.value))}>
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
                <option value={180}>3 hours</option>
                <option value={240}>4 hours</option>
              </Select>
            </div>
          </div>
          {ai && !ai.configured ? <Alert tone="warn">{ai.message}</Alert> : null}
        </div>
      </Modal>
    </div>
  )
}
