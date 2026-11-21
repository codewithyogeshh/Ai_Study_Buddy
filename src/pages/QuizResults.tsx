import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { ArrowLeft, Award, Check, Clock, RefreshCw, Target, X } from 'lucide-react'

import { Button, buttonClasses } from '../components/ui/Button'
import { Alert, Badge, Card, CardHeader, EmptyState, PageHeader, Progress, Skeleton } from '../components/ui/Card'
import { useToast } from '../contexts/ToastContext'
import { api, errorMessage } from '../lib/api'
import { formatDuration } from '../lib/format'
import type { Quiz } from '../types'

export function QuizResults() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { error: toastError } = useToast()
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [error, setError] = useState('')
  const [retrying, setRetrying] = useState(false)
  const [filter, setFilter] = useState<'all' | 'wrong'>('all')

  useEffect(() => {
    if (!id) return
    let active = true
    api
      .get<{ quiz: Quiz }>(`/quizzes/${id}`)
      .then((data) => active && setQuiz(data.quiz))
      .catch((err) => active && setError(errorMessage(err)))
    return () => {
      active = false
    }
  }, [id])

  async function retry() {
    if (!quiz?.documentId) {
      toastError('This quiz has no source document to retry from. Create a new quiz from your documents.')
      return
    }
    setRetrying(true)
    try {
      const data = await api.post<{ quizId: string }>('/ai/generate-quiz', {
        documentId: quiz.documentId,
        count: quiz.totalQuestions,
        difficulty: quiz.difficulty,
        type: 'mcq',
        language: 'english',
      })
      navigate(`/app/quiz/${data.quizId}`)
    } catch (err) {
      toastError(errorMessage(err))
    } finally {
      setRetrying(false)
    }
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link to="/app/quiz" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Back to quizzes
        </Link>
        <Alert tone="error">{error}</Alert>
      </div>
    )
  }

  if (!quiz) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-7 w-52" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (!quiz.completed || !quiz.result) return <Navigate to={`/app/quiz/${quiz.id}`} replace />

  const result = quiz.result
  const incorrect = result.graded.filter((item) => !item.correct)
  const shown = filter === 'all' ? result.graded : incorrect
  const tone = result.percentage >= 70 ? 'success' : result.percentage >= 40 ? 'warn' : 'danger'

  return (
    <div className="space-y-5">
      <Link to="/app/quiz" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Back to quizzes
      </Link>

      <PageHeader
        title="Quiz results"
        description={quiz.title}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" loading={retrying} onClick={() => void retry()} icon={<RefreshCw className="size-4" />}>
              Retry with new questions
            </Button>
            <Link to="/app/quiz" className={buttonClasses('primary', 'md')}>
              New quiz
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <Card className="p-5 text-center">
          <div className="relative mx-auto flex size-28 items-center justify-center">
            <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90">
              <circle cx="60" cy="60" r="52" fill="none" stroke="var(--surface-3)" strokeWidth="10" />
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke={tone === 'success' ? 'var(--success)' : tone === 'warn' ? 'var(--warn)' : 'var(--danger)'}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${(result.percentage / 100) * 327} 327`}
              />
            </svg>
            <div>
              <p className="text-[26px] font-semibold leading-none tracking-[-0.03em] text-ink">{result.percentage}%</p>
              <p className="mt-1 text-[11px] text-muted">score</p>
            </div>
          </div>
          <p className="mt-4 text-[15px] font-semibold text-ink">
            {result.score} / {result.total} correct
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{result.summary}</p>
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-3.5 text-left">
            <div>
              <p className="flex items-center gap-1 text-[10.5px] uppercase tracking-wide text-muted">
                <Award className="size-3" /> Correct
              </p>
              <p className="mt-0.5 text-[14px] font-semibold text-ok">{result.score}</p>
            </div>
            <div>
              <p className="flex items-center gap-1 text-[10.5px] uppercase tracking-wide text-muted">
                <X className="size-3" /> Incorrect
              </p>
              <p className="mt-0.5 text-[14px] font-semibold text-bad">{result.total - result.score}</p>
            </div>
            <div className="col-span-2 border-t border-line pt-2">
              <p className="flex items-center gap-1 text-[10.5px] uppercase tracking-wide text-muted">
                <Clock className="size-3" /> Time taken
              </p>
              <p className="mt-0.5 text-[14px] font-semibold text-ink">{formatDuration(quiz.timeTaken ?? 0)}</p>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          {result.weakTopics.length ? (
            <Card className="p-5">
              <div className="flex items-center gap-2">
                <Target className="size-4 text-warn" />
                <h2 className="text-[13.5px] font-semibold text-ink">Topics to revise</h2>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {result.weakTopics.map((topic) => (
                  <span key={topic} className="rounded-full border border-warn/25 bg-warn-soft px-2.5 py-1 text-[11.5px] text-warn">
                    {topic}
                  </span>
                ))}
              </div>
              <p className="mt-2.5 text-[12px] text-muted">
                Re-read these sections in your document, then generate a focused quiz on them.
              </p>
            </Card>
          ) : (
            <Alert tone="success" title="No weak topics detected">
              You answered every topic correctly in this quiz. Try a harder difficulty or a longer set.
            </Alert>
          )}

          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[13.5px] font-semibold text-ink">Performance by topic</h2>
            </div>
            <div className="mt-3 space-y-2.5">
              {Object.entries(
                result.graded.reduce<Record<string, { correct: number; total: number }>>((acc, item) => {
                  const key = item.topic || 'General'
                  acc[key] = acc[key] ?? { correct: 0, total: 0 }
                  acc[key].total += 1
                  if (item.correct) acc[key].correct += 1
                  return acc
                }, {}),
              ).map(([topic, stats]) => (
                <div key={topic}>
                  <div className="mb-1 flex items-center justify-between text-[12px]">
                    <span className="truncate text-ink-soft">{topic}</span>
                    <span className="tabular-nums text-muted">
                      {stats.correct}/{stats.total}
                    </span>
                  </div>
                  <Progress
                    value={(stats.correct / stats.total) * 100}
                    className="h-1.5"
                    tone={stats.correct / stats.total >= 0.7 ? 'success' : 'danger'}
                  />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader
          title="Answer review"
          description="Every question, your answer and why the correct one is right."
          action={
            <div className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5 text-[11.5px]">
              <button
                onClick={() => setFilter('all')}
                className={`rounded-md px-2.5 py-1 ${filter === 'all' ? 'bg-surface font-medium text-ink shadow-soft' : 'text-muted'}`}
              >
                All ({result.graded.length})
              </button>
              <button
                onClick={() => setFilter('wrong')}
                className={`rounded-md px-2.5 py-1 ${filter === 'wrong' ? 'bg-surface font-medium text-ink shadow-soft' : 'text-muted'}`}
              >
                Incorrect ({incorrect.length})
              </button>
            </div>
          }
        />
        <div className="space-y-3 px-5 pb-5 pt-4">
          {shown.length === 0 ? (
            <EmptyState icon={<Check className="size-4" />} title="Nothing incorrect" description="Every question was answered correctly." />
          ) : (
            shown.map((item, i) => (
              <div
                key={item.questionId}
                className={`rounded-xl border p-4 ${item.correct ? 'border-ok/25 bg-ok-soft/40' : 'border-bad/25 bg-bad-soft/30'}`}
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${
                      item.correct ? 'bg-ok text-white' : 'bg-bad text-white'
                    }`}
                  >
                    {item.correct ? <Check className="size-3" /> : <X className="size-3" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium text-ink">
                      {filter === 'wrong' ? `${i + 1}. ` : ''}
                      {item.question}
                    </p>
                    <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                      {item.options.map((option, optionIndex) => {
                        const isCorrect = optionIndex === item.correctIndex
                        const isSelected = optionIndex === item.selectedIndex
                        return (
                          <div
                            key={optionIndex}
                            className={`rounded-lg border px-2.5 py-1.5 text-[12px] ${
                              isCorrect
                                ? 'border-ok/40 bg-ok-soft text-ink'
                                : isSelected
                                  ? 'border-bad/40 bg-bad-soft text-ink'
                                  : 'border-line bg-surface text-muted'
                            }`}
                          >
                            <span className="font-medium">{String.fromCharCode(65 + optionIndex)}.</span> {option}
                            {isCorrect ? <span className="ml-1 text-[10.5px] font-medium text-ok">correct</span> : null}
                            {isSelected && !isCorrect ? <span className="ml-1 text-[10.5px] font-medium text-bad">your answer</span> : null}
                          </div>
                        )
                      })}
                    </div>
                    {item.selectedIndex === null ? (
                      <p className="mt-1.5 text-[11px] text-muted">You did not answer this question.</p>
                    ) : null}
                    <div className="mt-2 rounded-lg border border-line bg-surface px-2.5 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Why</p>
                      <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-soft">{item.explanation}</p>
                    </div>
                    <div className="mt-1.5">
                      <Badge>{item.topic}</Badge>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}
