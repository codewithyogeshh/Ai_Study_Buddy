import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Loader2,
  Mic,
  MicOff,
  Play,
  Sparkles,
  XCircle,
} from 'lucide-react'

import { Button, buttonClasses } from '../components/ui/Button'
import { Alert, Badge, Card, CardHeader, EmptyState, PageHeader, Progress, Skeleton } from '../components/ui/Card'
import { Input, Label, Select, Textarea } from '../components/ui/Field'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useAiStatus } from '../hooks/useAiStatus'
import { useSpeechToText } from '../hooks/useSpeech'
import { api, errorMessage } from '../lib/api'
import { formatDate } from '../lib/format'
import type { DocSummary, Language, VivaEvaluation, VivaSession, VivaSummary } from '../types'

type PastSession = {
  id: string
  subject: string
  topic: string
  difficulty: string
  score: number | null
  total: number | null
  completed: boolean
  createdAt: string
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11.5px]">
        <span className="text-muted">{label}</span>
        <span className="font-medium tabular-nums text-ink-soft">{value}/10</span>
      </div>
      <Progress value={value * 10} className="h-1.5" tone={value >= 7 ? 'success' : value >= 5 ? 'primary' : 'danger'} />
    </div>
  )
}

export function Viva() {
  const { id } = useParams<{ id?: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { success, error: toastError } = useToast()
  const ai = useAiStatus()
  const [params] = useSearchParams()

  const [documents, setDocuments] = useState<DocSummary[] | null>(null)
  const [past, setPast] = useState<PastSession[]>([])
  const [subject, setSubject] = useState('')
  const [topic, setTopic] = useState('')
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [count, setCount] = useState(5)
  const [language, setLanguage] = useState<Language>(user?.language ?? 'english')
  const [documentId, setDocumentId] = useState(params.get('documentId') ?? '')
  const [starting, setStarting] = useState(false)

  const [session, setSession] = useState<VivaSession | null>(null)
  const [summary, setSummary] = useState<VivaSummary | null>(null)
  const [viewIndex, setViewIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [evaluation, setEvaluation] = useState<VivaEvaluation | null>(null)
  const [error, setError] = useState('')

  const speech = useSpeechToText(language, (transcript) => {
    setAnswer((current) => (current ? `${current} ${transcript}` : transcript))
  })

  const loadPast = useCallback(async () => {
    try {
      const [docsData, vivaData] = await Promise.all([
        api.get<{ documents: DocSummary[] }>('/documents'),
        api.get<{ sessions: PastSession[] }>('/viva'),
      ])
      setDocuments(docsData.documents)
      setPast(vivaData.sessions)
      setDocumentId((current) => current || docsData.documents[0]?.id || '')
    } catch {
      setDocuments([])
    }
  }, [])

  useEffect(() => {
    if (!id) void loadPast()
  }, [id, loadPast])

  useEffect(() => {
    if (!id) return
    let active = true
    api
      .get<{ session: VivaSession; summary: VivaSummary | null }>(`/viva/${id}`)
      .then((data) => {
        if (!active) return
        setSession(data.session)
        setSummary(data.summary)
        setViewIndex(data.session.nextIndex)
        if (data.session.completed) {
          const last = data.session.evaluations[data.session.evaluations.length - 1]
          setEvaluation(last ?? null)
        }
      })
      .catch((err) => active && setError(errorMessage(err)))
    return () => {
      active = false
    }
  }, [id])

  async function start() {
    if (!subject.trim() || !topic.trim()) {
      toastError('Add both a subject and a topic to begin.')
      return
    }
    setStarting(true)
    setError('')
    try {
      const data = await api.post<{ session: VivaSession }>('/viva/start', {
        subject: subject.trim(),
        topic: topic.trim(),
        difficulty,
        count,
        language,
        documentId: documentId || undefined,
      })
      success('Your examiner is ready.')
      navigate(`/app/viva/${data.session.id}`)
    } catch (err) {
      setError(errorMessage(err))
      toastError(errorMessage(err))
    } finally {
      setStarting(false)
    }
  }

  async function submitAnswer() {
    if (!session) return
    if (answer.trim().length < 2) {
      toastError('Speak or type your answer first.')
      return
    }
    setSubmitting(true)
    try {
      const data = await api.post<{ evaluation: VivaEvaluation; nextQuestion: unknown; answeredCount: number }>(
        `/viva/${session.id}/answer`,
        { questionId: session.questions[viewIndex].id, answer: answer.trim() },
      )
      setEvaluation(data.evaluation)
      setSession({
        ...session,
        evaluations: [...session.evaluations, data.evaluation],
        nextIndex: data.answeredCount,
      })
      setAnswer('')
    } catch (err) {
      toastError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function finish() {
    if (!session) return
    setFinishing(true)
    try {
      const data = await api.post<{ summary: VivaSummary; session: VivaSession }>(`/viva/${session.id}/finish`)
      setSummary(data.summary)
      setSession(data.session)
      success('Viva complete — here is your report.')
    } catch (err) {
      toastError(errorMessage(err))
    } finally {
      setFinishing(false)
    }
  }

  // ---------- Setup screen ----------
  if (!id) {
    return (
      <div className="space-y-5">
        <PageHeader
          title="Viva practice"
          description="An AI examiner asks one question at a time, then scores your answer on accuracy, understanding and completeness."
        />
        {error ? <Alert tone="error">{error}</Alert> : null}
        {ai && !ai.configured ? <Alert tone="warn">{ai.message}</Alert> : null}

        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <Card className="p-5">
            <h2 className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
              <Sparkles className="size-4 text-primary" /> Set up your viva
            </h2>
            <div className="mt-4 space-y-3.5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="subject">Subject</Label>
                  <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Operating Systems" />
                </div>
                <div>
                  <Label htmlFor="topic">Topic</Label>
                  <Input id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Deadlocks" />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label htmlFor="difficulty">Difficulty</Label>
                  <Select id="difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="count">Questions</Label>
                  <Select id="count" value={count} onChange={(e) => setCount(Number(e.target.value))}>
                    {[3, 5, 7, 10].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="language">Language</Label>
                  <Select id="language" value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
                    <option value="english">English</option>
                    <option value="marathi">Marathi</option>
                    <option value="hindi">Hindi</option>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="viva-doc" hint="optional">
                  Base questions on
                </Label>
                <Select id="viva-doc" value={documentId} onChange={(e) => setDocumentId(e.target.value)}>
                  <option value="">General knowledge</option>
                  {(documents ?? []).map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.filename}
                    </option>
                  ))}
                </Select>
              </div>

              <Button className="w-full" size="lg" loading={starting} onClick={() => void start()} icon={<Play className="size-4" />}>
                Start viva
              </Button>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="Previous sessions" description="Your examiner remembers how you did." icon={<BookOpen className="size-4" />} />
            <div className="px-5 pb-5 pt-2">
              {past.length === 0 ? (
                <EmptyState
                  className="py-6"
                  icon={<Sparkles className="size-4" />}
                  title="No viva sessions yet"
                  description="Set up a subject and topic on the left to practise speaking your answers."
                />
              ) : (
                <ul className="divide-y divide-line">
                  {past.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <Link to={`/app/viva/${item.id}`} className="group block">
                          <p className="truncate text-[13px] font-medium text-ink group-hover:text-primary">
                            {item.subject} — {item.topic}
                          </p>
                          <p className="mt-0.5 text-[11px] capitalize text-muted">
                            {item.difficulty} · {formatDate(item.createdAt)}
                          </p>
                        </Link>
                      </div>
                      {item.completed && item.total ? (
                        <Badge tone={item.score && item.score / item.total >= 0.7 ? 'success' : 'warn'}>
                          {item.score}/{item.total}
                        </Badge>
                      ) : (
                        <Badge>In progress</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>
      </div>
    )
  }

  // ---------- Session ----------
  if (!session) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-7 w-52" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const question = session.questions[viewIndex]
  const answeredAll = session.evaluations.length >= session.questions.length
  const lastEvaluation = evaluation

  if (summary && session.completed) {
    return (
      <div className="space-y-5">
        <Link to="/app/viva" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Back to viva practice
        </Link>
        <PageHeader title="Viva report" description={`${session.subject} — ${session.topic}`} />
        <Card className="p-6 text-center">
          <p className="text-[12px] uppercase tracking-[0.14em] text-muted">Overall performance</p>
          <p className="mt-2 text-[32px] font-semibold tracking-[-0.03em] text-ink">{summary.averageScore} / 10</p>
          <p className="mx-auto mt-1.5 max-w-md text-[13px] text-muted">{summary.verdict}</p>
          <div className="mx-auto mt-4 grid max-w-md grid-cols-3 gap-3 border-t border-line pt-4">
            <div>
              <p className="text-[11px] text-muted">Questions</p>
              <p className="text-[15px] font-semibold text-ink">{session.questions.length}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted">Answered</p>
              <p className="text-[15px] font-semibold text-ink">{session.evaluations.length}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted">Difficulty</p>
              <p className="text-[15px] font-semibold capitalize text-ink">{session.difficulty}</p>
            </div>
          </div>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-5">
            <h2 className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ok">
              <CheckCircle2 className="size-4" /> Strengths
            </h2>
            {summary.strengths.length ? (
              <ul className="mt-2.5 space-y-1.5">
                {summary.strengths.map((item, i) => (
                  <li key={i} className="rounded-lg border border-line bg-surface-2/60 px-3 py-2 text-[12.5px] text-ink-soft">
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[12.5px] text-muted">No question scored above 7 this time.</p>
            )}
          </Card>
          <Card className="p-5">
            <h2 className="flex items-center gap-1.5 text-[13.5px] font-semibold text-warn">
              <XCircle className="size-4" /> Revise these
            </h2>
            {summary.weakTopics.length || summary.practiceAgain.length ? (
              <ul className="mt-2.5 space-y-1.5">
                {[...new Set([...summary.weakTopics, ...summary.practiceAgain])].map((item, i) => (
                  <li key={i} className="rounded-lg border border-warn/20 bg-warn-soft px-3 py-2 text-[12.5px] text-ink-soft">
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[12.5px] text-muted">Nothing flagged for revision.</p>
            )}
          </Card>
        </div>

        <Card className="p-5">
          <h2 className="text-[13.5px] font-semibold text-ink">Answer-by-answer feedback</h2>
          <div className="mt-3 space-y-3">
            {session.evaluations.map((item, i) => (
              <div key={item.questionId} className="rounded-xl border border-line bg-surface-2/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[13px] font-medium text-ink">
                    {i + 1}. {item.question}
                  </p>
                  <Badge tone={item.score >= 7 ? 'success' : item.score >= 5 ? 'warn' : 'danger'}>{item.score}/10</Badge>
                </div>
                <p className="mt-2 text-[12.5px] text-muted">
                  <span className="font-medium text-ink-soft">Your answer: </span>
                  {item.answer}
                </p>
                <p className="mt-1.5 text-[12.5px] text-ink-soft">{item.feedback}</p>
                {item.idealAnswer ? (
                  <div className="mt-2 rounded-lg border border-line bg-surface px-3 py-2">
                    <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted">An ideal answer</p>
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-soft">{item.idealAnswer}</p>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Link to="/app/viva" className={buttonClasses('primary', 'md')}>
            Practice another topic
          </Link>
          <Link to="/app/progress" className={buttonClasses('secondary', 'md')}>
            View progress
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <Link to="/app/viva" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Back to viva practice
      </Link>

      <PageHeader
        title={`${session.subject} — ${session.topic}`}
        description={`${session.difficulty} difficulty · question ${Math.min(viewIndex + 1, session.questions.length)} of ${session.questions.length}`}
        action={
          answeredAll ? (
            <Button loading={finishing} onClick={() => void finish()}>
              Finish and see report
            </Button>
          ) : null
        }
      />

      <Progress value={(session.evaluations.length / session.questions.length) * 100} className="h-1.5" />

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Card className="p-5">
          {!question ? (
            <EmptyState
              icon={<Sparkles className="size-4" />}
              title="All questions answered"
              description="Finish the session to get your overall report, strengths and revision list."
              action={
                <Button loading={finishing} onClick={() => void finish()}>
                  Finish viva
                </Button>
              }
            />
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary-soft text-[11px] font-semibold text-primary">
                  Q{viewIndex + 1}
                </span>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted">Examiner</p>
                  <p className="text-[12.5px] font-medium text-ink-soft">Answer in your own words</p>
                </div>
              </div>

              <p className="mt-4 text-[16px] font-medium leading-relaxed text-ink">{question.question}</p>

              {lastEvaluation && lastEvaluation.questionId === question.id ? (
                <div className="mt-4 space-y-4">
                  <div className="rounded-xl border border-line bg-surface-2/50 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-semibold text-ink">Examiner feedback</p>
                      <Badge tone={lastEvaluation.score >= 7 ? 'success' : lastEvaluation.score >= 5 ? 'warn' : 'danger'}>
                        {lastEvaluation.score}/10
                      </Badge>
                    </div>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">{lastEvaluation.feedback}</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <ScoreBar label="Accuracy" value={lastEvaluation.accuracy} />
                      <ScoreBar label="Understanding" value={lastEvaluation.understanding} />
                      <ScoreBar label="Completeness" value={lastEvaluation.completeness} />
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div>
                        <p className="text-[10.5px] font-semibold uppercase tracking-wide text-ok">What you got right</p>
                        <ul className="mt-1 space-y-1">
                          {lastEvaluation.correct.length ? (
                            lastEvaluation.correct.map((point, i) => (
                              <li key={i} className="flex gap-1.5 text-[12px] text-ink-soft">
                                <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-ok" /> {point}
                              </li>
                            ))
                          ) : (
                            <li className="text-[12px] text-muted">No correct points detected.</li>
                          )}
                        </ul>
                      </div>
                      <div>
                        <p className="text-[10.5px] font-semibold uppercase tracking-wide text-warn">What was missing</p>
                        <ul className="mt-1 space-y-1">
                          {lastEvaluation.missing.length ? (
                            lastEvaluation.missing.map((point, i) => (
                              <li key={i} className="flex gap-1.5 text-[12px] text-ink-soft">
                                <XCircle className="mt-0.5 size-3 shrink-0 text-warn" /> {point}
                              </li>
                            ))
                          ) : (
                            <li className="text-[12px] text-muted">Nothing important was missing.</li>
                          )}
                        </ul>
                      </div>
                    </div>
                    {lastEvaluation.idealAnswer ? (
                      <div className="mt-3 rounded-lg border border-line bg-surface px-3 py-2">
                        <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted">A simple ideal answer</p>
                        <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-soft">{lastEvaluation.idealAnswer}</p>
                      </div>
                    ) : null}
                  </div>

                  {viewIndex < session.questions.length - 1 ? (
                    <Button
                      onClick={() => {
                        setViewIndex((i) => i + 1)
                        setEvaluation(null)
                      }}
                    >
                      Next question <ArrowRight className="size-4" />
                    </Button>
                  ) : (
                    <Button loading={finishing} onClick={() => void finish()}>
                      Finish and see report
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <div className="relative mt-4">
                    <Textarea
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder="Type your answer, or use the microphone to speak it…"
                      className="min-h-[140px] pr-12 text-[13px]"
                      aria-label="Your answer"
                    />
                    {speech.supported ? (
                      <button
                        onClick={() => (speech.listening ? speech.stop() : speech.start())}
                        className={`absolute bottom-2.5 right-2.5 rounded-md p-1.5 transition ${
                          speech.listening ? 'bg-bad-soft text-bad' : 'text-muted hover:bg-surface-2 hover:text-ink'
                        }`}
                        aria-label={speech.listening ? 'Stop dictation' : 'Answer with your voice'}
                      >
                        {speech.listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                      </button>
                    ) : null}
                  </div>
                  {speech.listening ? <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-bad"><Loader2 className="size-3 animate-spin" /> Listening…</p> : null}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] text-muted">There is no single perfect answer — explain what you know.</p>
                    <Button loading={submitting} onClick={() => void submitAnswer()}>
                      Submit answer
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </Card>

        <div className="space-y-3">
          <Card className="p-4">
            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-muted">Progress</p>
            <p className="mt-1.5 text-[13px] text-ink-soft">
              {session.evaluations.length} of {session.questions.length} answered
            </p>
            <div className="mt-2.5 space-y-1.5">
              {session.questions.map((q, i) => {
                const done = session.evaluations.find((e) => e.questionId === q.id)
                return (
                  <div key={q.id} className="flex items-center gap-2 text-[11.5px]">
                    <span
                      className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium ${
                        done ? 'bg-ok-soft text-ok' : i === viewIndex ? 'bg-primary-soft text-primary' : 'bg-surface-2 text-muted'
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="truncate text-muted">{done ? `${done.score}/10` : i === viewIndex ? 'Current question' : 'Not yet asked'}</span>
                  </div>
                )
              })}
            </div>
            {answeredAll ? (
              <Button size="sm" className="mt-3 w-full" loading={finishing} onClick={() => void finish()}>
                Finish viva
              </Button>
            ) : null}
          </Card>
          <Alert tone="info">
            Your answers are evaluated by AI. Use the feedback as a study guide, not a final grade.
          </Alert>
        </div>
      </div>
    </div>
  )
}
