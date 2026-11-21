import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ArrowRight, FileText, GraduationCap, Sparkles, Trash2 } from 'lucide-react'

import { Button } from '../components/ui/Button'
import { Alert, Badge, Card, EmptyState, PageHeader, Progress, Skeleton } from '../components/ui/Card'
import { Input, Label, Select } from '../components/ui/Field'
import { Modal } from '../components/ui/Modal'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useAiStatus } from '../hooks/useAiStatus'
import { api, errorMessage } from '../lib/api'
import { relativeTime } from '../lib/format'
import type { DocSummary, Language, QuizListItem } from '../types'

export function QuizGenerator() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { success, error: toastError } = useToast()
  const ai = useAiStatus()
  const [params] = useSearchParams()

  const [documents, setDocuments] = useState<DocSummary[] | null>(null)
  const [quizzes, setQuizzes] = useState<QuizListItem[] | null>(null)
  const [documentId, setDocumentId] = useState(params.get('documentId') ?? '')
  const [count, setCount] = useState(10)
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [type, setType] = useState<'mcq' | 'tf' | 'mixed'>('mcq')
  const [language, setLanguage] = useState<Language>(user?.language ?? 'english')
  const [focus, setFocus] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [pendingDelete, setPendingDelete] = useState<QuizListItem | null>(null)

  const load = useCallback(async () => {
    try {
      const [docsData, quizData] = await Promise.all([
        api.get<{ documents: DocSummary[] }>('/documents'),
        api.get<{ quizzes: QuizListItem[] }>('/quizzes'),
      ])
      setDocuments(docsData.documents)
      setQuizzes(quizData.quizzes)
      setDocumentId((current) => current || docsData.documents[0]?.id || '')
    } catch (err) {
      setError(errorMessage(err))
      setDocuments([])
      setQuizzes([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function generate() {
    if (!documentId) {
      toastError('Choose a document first.')
      return
    }
    setGenerating(true)
    setError('')
    try {
      const data = await api.post<{ quizId: string }>('/ai/generate-quiz', {
        documentId,
        count,
        difficulty,
        type,
        language,
        focus: focus.trim() || undefined,
      })
      success('Quiz ready. Good luck!')
      navigate(`/app/quiz/${data.quizId}`)
    } catch (err) {
      setError(errorMessage(err))
      toastError(errorMessage(err))
    } finally {
      setGenerating(false)
    }
  }

  async function removeQuiz(quiz: QuizListItem) {
    try {
      await api.del(`/quizzes/${quiz.id}`)
      setQuizzes((list) => (list ?? []).filter((item) => item.id !== quiz.id))
      setPendingDelete(null)
      success('Quiz deleted.')
    } catch (err) {
      toastError(errorMessage(err))
    }
  }

  const hasDocuments = Boolean(documents && documents.length > 0)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Quizzes"
        description="Generate practice questions from your material. Correct answers stay hidden until you submit."
      />

      {error ? <Alert tone="error">{error}</Alert> : null}
      {ai && !ai.configured ? <Alert tone="warn">{ai.message}</Alert> : null}

      {!hasDocuments && documents ? (
        <Card>
          <EmptyState
            icon={<FileText className="size-4" />}
            title="Add study material first"
            description="Quizzes are generated from the text of a document you own."
            action={
              <Link to="/app/documents" className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-on-primary">
                Upload a document
              </Link>
            }
          />
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <Card className="p-5">
          <h2 className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
            <Sparkles className="size-4 text-primary" /> Create a quiz
          </h2>
          <p className="mt-1 text-[12.5px] text-muted">Questions are built only from the selected document.</p>

          <div className="mt-4 space-y-3.5">
            <div>
              <Label htmlFor="quiz-doc">Document</Label>
              <Select id="quiz-doc" value={documentId} onChange={(e) => setDocumentId(e.target.value)}>
                {(documents ?? []).map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.filename}
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Questions</Label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[5, 10, 15, 20].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setCount(value)}
                      className={`h-9 rounded-lg border text-[12.5px] font-medium transition ${
                        count === value
                          ? 'border-primary bg-primary-soft text-primary'
                          : 'border-line-strong bg-surface text-muted hover:text-ink'
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="quiz-difficulty">Difficulty</Label>
                <Select
                  id="quiz-difficulty"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="quiz-type">Question type</Label>
                <Select id="quiz-type" value={type} onChange={(e) => setType(e.target.value as 'mcq' | 'tf' | 'mixed')}>
                  <option value="mcq">Multiple choice</option>
                  <option value="tf">True or false</option>
                  <option value="mixed">Mixed</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="quiz-language">Language</Label>
                <Select id="quiz-language" value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
                  <option value="english">English</option>
                  <option value="marathi">Marathi</option>
                  <option value="hindi">Hindi</option>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="quiz-focus" hint="optional">
                Focus on a topic
              </Label>
              <Input
                id="quiz-focus"
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                placeholder="e.g. Chapter 4, deadlocks only"
                maxLength={300}
              />
            </div>

            <Button
              className="w-full"
              size="lg"
              loading={generating}
              disabled={!hasDocuments}
              onClick={() => void generate()}
              icon={<GraduationCap className="size-4" />}
            >
              {generating ? 'Writing questions…' : `Generate ${count} questions`}
            </Button>
            <p className="text-[11px] text-muted">
              Generation can take up to a minute for long documents. The quiz is saved automatically.
            </p>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-[13.5px] font-semibold text-ink">Your quizzes</h2>
            <span className="text-[11.5px] text-muted">{quizzes?.length ?? 0} total</span>
          </div>
          {quizzes === null ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          ) : quizzes.length === 0 ? (
            <EmptyState
              icon={<GraduationCap className="size-4" />}
              title="No quizzes yet"
              description="Generate your first quiz from the panel on the left."
            />
          ) : (
            <ul className="divide-y divide-line">
              {quizzes.map((quiz) => (
                <li key={quiz.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      to={quiz.completed ? `/app/quiz/${quiz.id}/results` : `/app/quiz/${quiz.id}`}
                      className="group block"
                    >
                      <p className="truncate text-[13px] font-medium text-ink group-hover:text-primary">{quiz.title}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted">
                        <span className="capitalize">{quiz.difficulty}</span>
                        <span aria-hidden>·</span>
                        <span>{quiz.totalQuestions} questions</span>
                        <span aria-hidden>·</span>
                        <span>{relativeTime(quiz.createdAt)}</span>
                      </p>
                      {quiz.completed ? (
                        <div className="mt-1.5 flex items-center gap-2">
                          <Progress
                            value={quiz.totalQuestions ? (quiz.score / quiz.totalQuestions) * 100 : 0}
                            className="h-1.5"
                            tone={quiz.score / Math.max(1, quiz.totalQuestions) >= 0.7 ? 'success' : 'primary'}
                          />
                          <span className="shrink-0 text-[10.5px] font-medium tabular-nums text-muted">
                            {quiz.score}/{quiz.totalQuestions}
                          </span>
                        </div>
                      ) : null}
                    </Link>
                  </div>
                  {quiz.completed ? (
                    <Badge tone="success">Done</Badge>
                  ) : (
                    <Link to={`/app/quiz/${quiz.id}`} className="inline-flex items-center gap-1 text-[11.5px] font-medium text-primary hover:underline">
                      Resume <ArrowRight className="size-3" />
                    </Link>
                  )}
                  <button
                    onClick={() => setPendingDelete(quiz)}
                    className="rounded-md p-1.5 text-muted transition hover:bg-bad-soft hover:text-bad"
                    aria-label={`Delete quiz ${quiz.title}`}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Modal
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title="Delete this quiz?"
        description="Its result will no longer count towards your progress."
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => pendingDelete && void removeQuiz(pendingDelete)}>
              Delete quiz
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-ink-soft">{pendingDelete?.title}</p>
      </Modal>
    </div>
  )
}
