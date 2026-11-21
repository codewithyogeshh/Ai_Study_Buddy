import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Award, BookOpen, CheckCircle2, Clock3, GraduationCap, Target, TrendingUp, Trophy } from 'lucide-react'

import { ActivityChart, ScoreChart, TopicBars } from '../components/charts/Charts'
import { buttonClasses } from '../components/ui/Button'
import { Alert, Badge, Card, CardHeader, EmptyState, PageHeader, Progress as ProgressBar, Skeleton } from '../components/ui/Card'
import { api, errorMessage } from '../lib/api'
import { formatDate, formatMinutes } from '../lib/format'
import type { ProgressData } from '../types'

export function Progress() {
  const [data, setData] = useState<ProgressData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    api
      .get<ProgressData>('/analytics/progress')
      .then((result) => active && setData(result))
      .catch((err) => active && setError(errorMessage(err)))
    return () => {
      active = false
    }
  }, [])

  const totals = data?.totals
  const cards = [
    { label: 'Quizzes completed', value: totals?.quizzes ?? 0, icon: GraduationCap, hint: 'Submitted quizzes' },
    { label: 'Average score', value: `${totals?.averageScore ?? 0}%`, icon: Target, hint: `Best ${totals?.bestScore ?? 0}%` },
    { label: 'Tasks completed', value: totals?.tasksCompleted ?? 0, icon: CheckCircle2, hint: `of ${totals?.tasksTotal ?? 0} planned` },
    { label: 'Study time', value: formatMinutes(totals?.studyMinutes ?? 0), icon: Clock3, hint: `${totals?.pagesRead ?? 0} pages uploaded` },
  ]

  return (
    <div className="space-y-5">
      <PageHeader title="Progress" description="Everything here is calculated from your own activity — quizzes, tasks and study sessions." />
      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label} className="p-4">
            {data ? (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-[12px] font-medium text-muted">{card.label}</p>
                  <card.icon className="size-4 text-muted" />
                </div>
                <p className="mt-2 text-[24px] font-semibold leading-none tracking-[-0.03em] text-ink">{card.value}</p>
                <p className="mt-1.5 text-[11.5px] text-muted">{card.hint}</p>
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Quiz scores over time" description="Percentage per completed quiz" icon={<TrendingUp className="size-4" />} />
          <div className="px-5 pb-5 pt-4">
            {!data ? (
              <Skeleton className="h-[190px] w-full" />
            ) : data.quizHistory.length === 0 ? (
              <EmptyState
                className="py-8"
                icon={<GraduationCap className="size-4" />}
                title="No quiz results yet"
                description="Complete a quiz to start building your score trend."
                action={
                  <Link to="/app/quiz" className={buttonClasses('secondary', 'sm')}>
                    Create a quiz
                  </Link>
                }
              />
            ) : (
              <ScoreChart
                points={data.quizHistory.slice(-12).map((item) => ({ label: formatDate(item.date), value: item.percentage }))}
              />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Study activity" description="Minutes studied per day (last 30 days)" icon={<BookOpen className="size-4" />} />
          <div className="px-5 pb-5 pt-4">
            {!data ? <Skeleton className="h-[190px] w-full" /> : <ActivityChart data={data.activity} height={190} />}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader title="Topic mastery" description="Correct answers per topic across all quizzes" icon={<Award className="size-4" />} />
          <div className="px-5 pb-5 pt-4">
            {!data ? (
              <div className="space-y-3">
                <Skeleton className="h-4" />
                <Skeleton className="h-4" />
                <Skeleton className="h-4" />
              </div>
            ) : data.topics.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-muted">Finish a quiz to see topic-level strengths.</p>
            ) : (
              <TopicBars topics={data.topics} />
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Needs revision" description="Topics you most often got wrong" icon={<Target className="size-4" />} />
            <div className="px-5 pb-5 pt-3">
              {!data ? (
                <Skeleton className="h-16 w-full" />
              ) : data.weakTopics.length === 0 ? (
                <p className="text-[13px] text-muted">No weak topics detected yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {data.weakTopics.map((topic) => (
                    <li key={topic.topic} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2/50 px-3 py-2">
                      <span className="truncate text-[12.5px] text-ink-soft">{topic.topic}</span>
                      <Badge tone="warn">{topic.count}× missed</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Where your study time goes" description="Sessions by activity" icon={<Trophy className="size-4" />} />
            <div className="px-5 pb-5 pt-3">
              {!data ? (
                <Skeleton className="h-16 w-full" />
              ) : data.bySource.length === 0 ? (
                <p className="text-[13px] text-muted">Log some activity by chatting, taking a quiz or finishing a viva.</p>
              ) : (
                <div className="space-y-2.5">
                  {data.bySource.map((source) => {
                    const max = Math.max(...data.bySource.map((item) => item.count))
                    return (
                      <div key={source.source}>
                        <div className="flex items-center justify-between text-[12px]">
                          <span className="capitalize text-ink-soft">{source.source}</span>
                          <span className="text-muted">{source.count}</span>
                        </div>
                        <ProgressBar value={(source.count / max) * 100} className="mt-1 h-1.5" />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader title="Quiz history" description="Every completed attempt, newest first" icon={<GraduationCap className="size-4" />} />
        <div className="px-5 pb-5 pt-4">
          {!data ? (
            <Skeleton className="h-24 w-full" />
          ) : data.quizHistory.length === 0 ? (
            <EmptyState
              className="py-8"
              icon={<GraduationCap className="size-4" />}
              title="Nothing attempted yet"
              description="Your quiz history will appear here once you submit your first quiz."
              action={
                <Link to="/app/quiz" className={buttonClasses('primary', 'sm')}>
                  Generate a quiz
                </Link>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-[12.5px]">
                <thead className="text-[11px] uppercase tracking-wide text-muted">
                  <tr className="border-b border-line">
                    <th className="py-2 font-medium">Quiz</th>
                    <th className="py-2 font-medium">Date</th>
                    <th className="py-2 font-medium">Score</th>
                    <th className="py-2 font-medium">Result</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {[...data.quizHistory].reverse().map((entry) => (
                    <tr key={entry.id}>
                      <td className="max-w-[240px] truncate py-2.5 text-ink">{entry.title}</td>
                      <td className="py-2.5 text-muted">{formatDate(entry.date)}</td>
                      <td className="py-2.5 tabular-nums text-ink-soft">
                        {entry.score}/{entry.total}
                      </td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <ProgressBar
                            value={entry.percentage}
                            className="h-1.5 w-20"
                            tone={entry.percentage >= 70 ? 'success' : entry.percentage >= 40 ? 'primary' : 'danger'}
                          />
                          <span className="tabular-nums text-muted">{entry.percentage}%</span>
                        </div>
                      </td>
                      <td className="py-2.5 text-right">
                        <Link to={`/app/quiz/${entry.id}/results`} className="text-[12px] font-medium text-primary hover:underline">
                          Review
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      <p className="pb-2 text-center text-[11px] text-muted">
        Study time is logged from quizzes, chats, viva sessions and completed planner tasks.
      </p>
    </div>
  )
}
