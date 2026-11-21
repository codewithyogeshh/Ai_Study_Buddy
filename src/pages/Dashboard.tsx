import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import {
  ArrowRight,
  BookOpenCheck,
  BrainCircuit,
  CalendarDays,
  Clock3,
  FileText,
  Flame,
  GraduationCap,
  Layers,
  MessageSquare,
  Plus,
  Sparkles,
  Target,
  TrendingUp,
  Upload,
} from 'lucide-react'

import { ActivityChart } from '../components/charts/Charts'
import { buttonClasses } from '../components/ui/Button'
import { Alert, Badge, Card, CardHeader, EmptyState, PageHeader, Progress, Skeleton } from '../components/ui/Card'
import { useAuth } from '../contexts/AuthContext'
import { useAiStatus } from '../hooks/useAiStatus'
import { api, errorMessage } from '../lib/api'
import { formatDate, formatMinutes, relativeTime } from '../lib/format'
import type { DashboardData } from '../types'

const quickActions = [
  { to: '/app/documents', label: 'Upload PDF', icon: Upload, tint: 'bg-primary-soft text-primary' },
  { to: '/app/chat', label: 'Ask AI', icon: MessageSquare, tint: 'bg-primary-soft text-primary' },
  { to: '/app/notes', label: 'Generate notes', icon: BookOpenCheck, tint: 'bg-ok-soft text-ok' },
  { to: '/app/quiz', label: 'Create quiz', icon: GraduationCap, tint: 'bg-warn-soft text-warn' },
  { to: '/app/viva', label: 'Start viva', icon: Sparkles, tint: 'bg-bad-soft text-bad' },
]

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function Dashboard() {
  const { user } = useAuth()
  const ai = useAiStatus()
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    api
      .get<DashboardData>('/analytics/dashboard')
      .then((result) => active && setData(result))
      .catch((err) => active && setError(errorMessage(err)))
    return () => {
      active = false
    }
  }, [])

  const firstName = user?.name?.split(' ')[0] ?? 'there'
  const stats = data?.stats

  const statCards = [
    {
      label: 'Documents',
      value: stats?.documents ?? 0,
      hint: `${stats?.notes ?? 0} saved note sets`,
      icon: FileText,
    },
    {
      label: 'Quizzes completed',
      value: stats?.quizzesCompleted ?? 0,
      hint: `${stats?.flashcardDecks ?? 0} flashcard decks`,
      icon: GraduationCap,
    },
    {
      label: 'Average score',
      value: `${stats?.averageScore ?? 0}%`,
      hint:
        stats && stats.quizzesCompleted > 0
          ? stats.averageScore >= 75
            ? 'Strong performance'
            : 'Keep practising'
          : 'Take your first quiz',
      icon: Target,
    },
    {
      label: 'Study time',
      value: formatMinutes(stats?.studyMinutes ?? 0),
      hint: `${stats?.studyStreak ?? 0}-day streak`,
      icon: Clock3,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        description="Here is what your study space looks like today."
        action={
          <Link to="/app/documents" className={buttonClasses('primary', 'md')}>
            <Plus className="size-4" />
            Upload material
          </Link>
        }
      />

      {ai && !ai.configured ? (
        <Alert tone="warn" title="AI features are waiting for an API key">
          {ai.message} Add <code className="rounded bg-surface px-1 py-0.5 text-[11.5px]">GEMINI_API_KEY</code> to the
          backend environment. Uploads, notes and quizzes you already saved still work.
        </Alert>
      ) : null}

      {error ? <Alert tone="error">{error}</Alert> : null}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {quickActions.map((action) => (
          <Link
            key={action.to}
            to={action.to}
            className="group flex items-center gap-2.5 rounded-xl border border-line bg-surface p-3 shadow-soft transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-raised"
          >
            <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${action.tint}`}>
              <action.icon className="size-4" />
            </span>
            <span className="min-w-0 text-[12.5px] font-medium leading-tight text-ink">{action.label}</span>
          </Link>
        ))}
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="p-4">
            {data ? (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-[12px] font-medium text-muted">{stat.label}</p>
                  <stat.icon className="size-4 text-muted" />
                </div>
                <p className="mt-2 text-[26px] font-semibold leading-none tracking-[-0.03em] text-ink">{stat.value}</p>
                <p className="mt-1.5 text-[11.5px] text-muted">{stat.hint}</p>
              </>
            ) : (
              <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-14" />
                <Skeleton className="h-3 w-24" />
              </div>
            )}
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
        {/* Activity */}
        <Card>
          <CardHeader
            title="Study activity"
            description="Minutes of study over the last 14 days"
            icon={<TrendingUp className="size-4" />}
            action={
              <Link to="/app/progress" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-primary hover:underline">
                Full report <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          <div className="px-5 pb-5 pt-4">
            {data ? (
              <>
                <ActivityChart data={data.activity} />
                <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-3.5">
                  <div>
                    <p className="text-[11px] text-muted">Total study time</p>
                    <p className="mt-0.5 text-[14px] font-semibold text-ink">{formatMinutes(stats?.studyMinutes ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted">Sessions logged</p>
                    <p className="mt-0.5 text-[14px] font-semibold text-ink">{stats?.studySessions ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted">Current streak</p>
                    <p className="mt-0.5 flex items-center gap-1 text-[14px] font-semibold text-ink">
                      <Flame className={`size-3.5 ${stats?.studyStreak ? 'text-warn' : 'text-muted'}`} />
                      {stats?.studyStreak ?? 0} days
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <Skeleton className="h-[150px] w-full" />
            )}
          </div>
        </Card>

        {/* Upcoming tasks */}
        <Card>
          <CardHeader
            title="Upcoming tasks"
            description="From your study planner"
            icon={<CalendarDays className="size-4" />}
            action={
              <Link to="/app/planner" className="text-[12.5px] font-medium text-primary hover:underline">
                Planner
              </Link>
            }
          />
          <div className="px-5 pb-5 pt-3">
            {!data ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : data.upcomingTasks.length === 0 ? (
              <EmptyState
                className="py-6"
                icon={<CalendarDays className="size-4" />}
                title="No tasks scheduled"
                description="Add tasks or let the AI build a plan around your exam date."
                action={
                  <Link to="/app/planner" className={buttonClasses('secondary', 'sm')}>
                    Open planner
                  </Link>
                }
              />
            ) : (
              <ul className="divide-y divide-line">
                {data.upcomingTasks.map((task) => (
                  <li key={task.id} className="flex items-start gap-2.5 py-2.5">
                    <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-ink">{task.title}</p>
                      <p className="mt-0.5 text-[11.5px] text-muted">
                        {task.subject}
                        {task.dueDate ? ` · due ${formatDate(task.dueDate)}` : ''}
                      </p>
                    </div>
                    {task.dueDate && task.dueDate <= new Date().toISOString().slice(0, 10) ? (
                      <Badge tone="warn">Today</Badge>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent documents */}
        <Card>
          <CardHeader
            title="Recent documents"
            icon={<FileText className="size-4" />}
            action={
              <Link to="/app/documents" className="text-[12.5px] font-medium text-primary hover:underline">
                View all
              </Link>
            }
          />
          <div className="px-5 pb-5 pt-2">
            {!data ? (
              <Skeleton className="h-24 w-full" />
            ) : data.recentDocuments.length === 0 ? (
              <EmptyState
                className="py-6"
                icon={<Upload className="size-4" />}
                title="No documents yet"
                description="Upload a PDF, DOCX or TXT file to unlock summaries, notes, quizzes and chat."
                action={
                  <Link to="/app/documents" className={buttonClasses('primary', 'sm')}>
                    Upload your first document
                  </Link>
                }
              />
            ) : (
              <ul className="divide-y divide-line">
                {data.recentDocuments.map((doc) => (
                  <li key={doc.id}>
                    <Link to={`/app/documents/${doc.id}`} className="group flex items-center gap-3 py-2.5">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-[10px] font-semibold uppercase text-muted">
                        {doc.fileType}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-ink group-hover:text-primary">{doc.filename}</p>
                        <p className="mt-0.5 text-[11.5px] text-muted">
                          {doc.pageCount} pages · {relativeTime(doc.uploadDate)}
                        </p>
                      </div>
                      {doc.processingStatus === 'ready' ? (
                        <Badge tone={doc.hasAnalysis ? 'success' : 'neutral'}>{doc.hasAnalysis ? 'Analysed' : 'Ready'}</Badge>
                      ) : (
                        <Badge tone="warn">Needs OCR</Badge>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        {/* Recent quizzes */}
        <Card>
          <CardHeader
            title="Recent quizzes"
            icon={<GraduationCap className="size-4" />}
            action={
              <Link to="/app/quiz" className="text-[12.5px] font-medium text-primary hover:underline">
                View all
              </Link>
            }
          />
          <div className="px-5 pb-5 pt-2">
            {!data ? (
              <Skeleton className="h-24 w-full" />
            ) : data.recentQuizzes.length === 0 ? (
              <EmptyState
                className="py-6"
                icon={<BrainCircuit className="size-4" />}
                title="No quizzes attempted"
                description="Generate a quiz from any document to start testing your recall."
                action={
                  <Link to="/app/quiz" className={buttonClasses('secondary', 'sm')}>
                    Create a quiz
                  </Link>
                }
              />
            ) : (
              <ul className="divide-y divide-line">
                {data.recentQuizzes.map((quiz) => (
                  <li key={quiz.id}>
                    <Link
                      to={quiz.completed ? `/app/quiz/${quiz.id}/results` : `/app/quiz/${quiz.id}`}
                      className="group block py-2.5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-[13px] font-medium text-ink group-hover:text-primary">{quiz.title}</p>
                        {quiz.completed ? (
                          <span className="shrink-0 text-[12px] font-semibold tabular-nums text-ink">{quiz.percentage}%</span>
                        ) : (
                          <Badge tone="warn">Unfinished</Badge>
                        )}
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <Progress value={quiz.percentage} tone={quiz.percentage >= 70 ? 'success' : quiz.percentage >= 40 ? 'primary' : 'danger'} className="h-1.5" />
                        <span className="shrink-0 text-[11px] text-muted">
                          {quiz.completed ? `${quiz.score}/${quiz.totalQuestions}` : `${quiz.totalQuestions} questions`}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      {(data?.weakTopics.length || data?.frequentTopics.length) ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-primary" />
              <h2 className="text-[13.5px] font-semibold text-ink">Frequently studied</h2>
            </div>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {data?.frequentTopics.map((topic) => (
                <li key={topic.topic} className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[11.5px] text-ink-soft">
                  {topic.topic}
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Target className="size-4 text-warn" />
              <h2 className="text-[13.5px] font-semibold text-ink">Needs revision</h2>
            </div>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {data?.weakTopics.map((topic) => (
                <li key={topic.topic} className="rounded-full border border-warn/25 bg-warn-soft px-2.5 py-1 text-[11.5px] text-warn">
                  {topic.topic}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ) : null}
    </div>
  )
}
