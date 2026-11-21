import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { ArrowLeft, ArrowRight, Check, Clock, Flag, Timer } from 'lucide-react'

import { Button } from '../components/ui/Button'
import { Alert, Badge, Card, EmptyState, PageHeader, Progress, Skeleton } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { useToast } from '../contexts/ToastContext'
import { api, errorMessage } from '../lib/api'
import { formatDuration } from '../lib/format'
import type { Quiz } from '../types'

export function QuizTake() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { error: toastError } = useToast()
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [error, setError] = useState('')
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [elapsed, setElapsed] = useState(0)
  const [timed, setTimed] = useState(false)
  const [remaining, setRemaining] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [confirmSubmit, setConfirmSubmit] = useState(false)
  const submittedRef = useRef(false)
  const startedAt = useRef(Date.now())

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

  useEffect(() => {
    if (!quiz || quiz.completed) return
    const timer = window.setInterval(() => {
      const seconds = Math.floor((Date.now() - startedAt.current) / 1000)
      setElapsed(seconds)
      if (timed) {
        const limit = quiz.totalQuestions * 60
        setRemaining(Math.max(0, limit - seconds))
      }
    }, 1000)
    return () => window.clearInterval(timer)
  }, [quiz, timed])

  const submit = useCallback(
    async (auto = false) => {
      if (!quiz || submittedRef.current) return
      submittedRef.current = true
      setSubmitting(true)
      try {
        await api.post(`/quizzes/${quiz.id}/submit`, {
          answers: quiz.questions.map((question) => ({
            questionId: question.id,
            selectedIndex: answers[question.id] ?? null,
          })),
          timeTaken: Math.floor((Date.now() - startedAt.current) / 1000),
        })
        navigate(`/app/quiz/${quiz.id}/results`, { replace: true })
      } catch (err) {
        submittedRef.current = false
        setSubmitting(false)
        setConfirmSubmit(false)
        toastError(auto ? `Time is up, but submission failed: ${errorMessage(err)}` : errorMessage(err))
      }
    },
    [answers, navigate, quiz, toastError],
  )

  useEffect(() => {
    if (timed && quiz && remaining === 0 && !quiz.completed && !submitting) {
      void submit(true)
    }
  }, [timed, remaining, quiz, submit, submitting])

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
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-72 w-full" />
      </div>
    )
  }

  if (quiz.completed) return <Navigate to={`/app/quiz/${quiz.id}/results`} replace />

  if (quiz.questions.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Flag className="size-4" />}
          title="This quiz has no questions"
          description="It may have been created before generation finished. Create a new quiz."
          action={
            <Link to="/app/quiz" className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-on-primary">
              Back to quizzes
            </Link>
          }
        />
      </Card>
    )
  }

  const question = quiz.questions[index]
  const answeredCount = Object.keys(answers).length
  const limit = quiz.totalQuestions * 60

  return (
    <div className="space-y-4">
      <Link to="/app/quiz" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Back to quizzes
      </Link>

      <PageHeader
        title={quiz.title}
        description={`${quiz.totalQuestions} questions · ${quiz.difficulty} difficulty`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] tabular-nums text-ink-soft">
              <Clock className="size-3.5 text-muted" />
              {formatDuration(elapsed)}
            </div>
            <button
              onClick={() => {
                setTimed((v) => !v)
                setRemaining(timed ? 0 : Math.max(0, limit - elapsed))
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition ${
                timed ? 'border-primary/30 bg-primary-soft text-primary' : 'border-line bg-surface text-muted hover:text-ink'
              }`}
            >
              <Timer className="size-3.5" />
              {timed ? `Timed · ${formatDuration(remaining)} left` : 'Enable timer'}
            </button>
          </div>
        }
      />

      {timed ? (
        <Progress value={limit ? (remaining / limit) * 100 : 0} tone={remaining < 60 ? 'danger' : 'primary'} className="h-1.5" />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
        <Card className="flex flex-col p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12px] font-medium text-muted">
              Question {index + 1} of {quiz.questions.length}
            </span>
            <Badge tone="primary">{question.topic}</Badge>
          </div>

          <Progress value={((index + 1) / quiz.questions.length) * 100} className="mt-2.5 h-1" />

          <h2 className="mt-5 text-[16px] font-medium leading-relaxed text-ink">{question.question}</h2>

          <div className="mt-4 space-y-2" role="radiogroup" aria-label="Answer options">
            {question.options.map((option, optionIndex) => {
              const selected = answers[question.id] === optionIndex
              return (
                <button
                  key={optionIndex}
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setAnswers((current) => ({ ...current, [question.id]: optionIndex }))}
                  className={`flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left text-[13.5px] transition ${
                    selected
                      ? 'border-primary bg-primary-soft text-ink'
                      : 'border-line bg-surface text-ink-soft hover:border-line-strong hover:bg-surface-2'
                  }`}
                >
                  <span
                    className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-[10.5px] font-semibold ${
                      selected ? 'border-primary bg-primary text-on-primary' : 'border-line-strong text-muted'
                    }`}
                  >
                    {selected ? <Check className="size-3" /> : String.fromCharCode(65 + optionIndex)}
                  </span>
                  <span>{option}</span>
                </button>
              )
            })}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
            <Button
              variant="secondary"
              disabled={index === 0}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              icon={<ArrowLeft className="size-4" />}
            >
              Previous
            </Button>
            <div className="flex gap-2">
              {index < quiz.questions.length - 1 ? (
                <Button onClick={() => setIndex((i) => Math.min(quiz.questions.length - 1, i + 1))}>
                  Next <ArrowRight className="size-4" />
                </Button>
              ) : (
                <Button onClick={() => setConfirmSubmit(true)} loading={submitting}>
                  Submit quiz
                </Button>
              )}
            </div>
          </div>
        </Card>

        <div className="space-y-3">
          <Card className="p-4">
            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-muted">Questions</p>
            <div className="mt-2.5 grid grid-cols-5 gap-1.5 lg:grid-cols-4">
              {quiz.questions.map((item, i) => {
                const isAnswered = answers[item.id] !== undefined
                return (
                  <button
                    key={item.id}
                    onClick={() => setIndex(i)}
                    className={`flex h-8 items-center justify-center rounded-md border text-[11.5px] font-medium transition ${
                      i === index
                        ? 'border-primary bg-primary text-on-primary'
                        : isAnswered
                          ? 'border-ok/30 bg-ok-soft text-ok'
                          : 'border-line bg-surface text-muted hover:text-ink'
                    }`}
                    aria-label={`Go to question ${i + 1}${isAnswered ? ' (answered)' : ''}`}
                  >
                    {i + 1}
                  </button>
                )
              })}
            </div>
            <div className="mt-3 space-y-1 border-t border-line pt-2.5 text-[11px] text-muted">
              <p className="flex items-center gap-1.5">
                <span className="size-2 rounded-sm bg-ok-soft ring-1 ring-ok/30" /> Answered
              </p>
              <p className="flex items-center gap-1.5">
                <span className="size-2 rounded-sm bg-surface ring-1 ring-line-strong" /> Not answered
              </p>
            </div>
          </Card>

          <Card className="p-4">
            <p className="text-[12px] text-muted">
              {answeredCount} of {quiz.questions.length} answered
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-2 w-full"
              onClick={() => setConfirmSubmit(true)}
              disabled={submitting}
            >
              Submit quiz
            </Button>
            <p className="mt-2 text-[10.5px] leading-relaxed text-muted">
              Correct answers are revealed only after you submit.
            </p>
          </Card>
        </div>
      </div>

      <Modal
        open={confirmSubmit}
        onClose={() => setConfirmSubmit(false)}
        title="Submit your quiz?"
        description={
          answeredCount < quiz.questions.length
            ? `${quiz.questions.length - answeredCount} question(s) are still unanswered. Unanswered questions score zero.`
            : 'All questions are answered. You cannot change answers after submitting.'
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmSubmit(false)}>
              Keep working
            </Button>
            <Button loading={submitting} onClick={() => void submit()}>
              Submit and see results
            </Button>
          </>
        }
      >
        <div className="rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-[13px] text-ink-soft">
          {answeredCount} / {quiz.questions.length} answered · {formatDuration(elapsed)} elapsed
        </div>
      </Modal>
    </div>
  )
}
