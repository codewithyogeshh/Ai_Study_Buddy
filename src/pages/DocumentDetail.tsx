import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import {
  ArrowLeft,
  BookOpenCheck,
  FileText,
  GraduationCap,
  Layers,
  ListChecks,
  Loader2,
  MessageSquare,
  RefreshCw,
  ScrollText,
  Sparkles,
} from 'lucide-react'

import { Button, buttonClasses } from '../components/ui/Button'
import { Alert, Badge, Card, EmptyState, PageHeader, Skeleton } from '../components/ui/Card'
import { Segmented } from '../components/ui/Card'
import { useToast } from '../contexts/ToastContext'
import { api, errorMessage } from '../lib/api'
import { formatBytes, formatDate } from '../lib/format'
import type { DocumentDetail as DocumentDetailType } from '../types'

type Tab = 'summary' | 'concepts' | 'definitions' | 'questions' | 'chapters' | 'text'

export function DocumentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { success, error: toastError } = useToast()
  const [doc, setDoc] = useState<DocumentDetailType | null>(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('summary')
  const [analysing, setAnalysing] = useState(false)

  useEffect(() => {
    if (!id) return
    let active = true
    setDoc(null)
    setError('')
    api
      .get<{ document: DocumentDetailType }>(`/documents/${id}`)
      .then((data) => {
        if (!active) return
        setDoc(data.document)
        if (!data.document.analysis) setTab('text')
      })
      .catch((err) => active && setError(errorMessage(err)))
    return () => {
      active = false
    }
  }, [id])

  async function analyse() {
    if (!doc) return
    setAnalysing(true)
    try {
      const data = await api.post<{ analysis: NonNullable<DocumentDetailType['analysis']> }>(`/ai/summarize`, {
        documentId: doc.id,
        force: true,
      })
      setDoc({ ...doc, analysis: data.analysis, hasAnalysis: true })
      setTab('summary')
      success('Document analysed.')
    } catch (err) {
      toastError(errorMessage(err))
    } finally {
      setAnalysing(false)
    }
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link to="/app/documents" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Back to documents
        </Link>
        <Alert tone="error">{error}</Alert>
      </div>
    )
  }

  if (!doc) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  const analysis = doc.analysis
  const needsOcr = doc.processingStatus === 'needs_ocr' || doc.processingStatus === 'empty'
  const quickLinks = [
    { to: `/app/chat?documentId=${doc.id}`, label: 'Ask AI', icon: MessageSquare },
    { to: `/app/notes?documentId=${doc.id}`, label: 'Notes', icon: BookOpenCheck },
    { to: `/app/quiz?documentId=${doc.id}`, label: 'Quiz', icon: GraduationCap },
    { to: `/app/flashcards?documentId=${doc.id}`, label: 'Flashcards', icon: Layers },
    { to: `/app/viva?documentId=${doc.id}`, label: 'Viva', icon: Sparkles },
  ]

  return (
    <div className="space-y-5">
      <Link to="/app/documents" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Back to documents
      </Link>

      <PageHeader
        title={doc.filename}
        description={`${doc.fileType.toUpperCase()} · ${formatBytes(doc.fileSize)} · ${doc.pageCount} pages · ${doc.wordCount.toLocaleString()} words · uploaded ${formatDate(doc.uploadDate)}`}
        action={
          <div className="flex flex-wrap gap-2">
            {doc.textLength > 0 ? (
              <Button
                variant={analysis ? 'secondary' : 'primary'}
                loading={analysing}
                onClick={() => void analyse()}
                icon={analysis ? <RefreshCw className="size-4" /> : <ListChecks className="size-4" />}
              >
                {analysis ? 'Re-analyse' : 'Analyse document'}
              </Button>
            ) : null}
          </div>
        }
      />

      {needsOcr ? (
        <Alert tone="warn" title="Very little text could be extracted">
          This looks like a scanned PDF or an empty file. OCR is not available on this deployment, so the AI cannot read
          the pages. Upload a text-based PDF, a DOCX, or a TXT version of the material.
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        {quickLinks.map((link) => (
          <Link key={link.to} to={link.to} className={buttonClasses('secondary', 'sm')}>
            <link.icon className="size-3.5" />
            {link.label}
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        {/* Extracted text */}
        <Card className="flex min-h-[520px] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <h2 className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
              <ScrollText className="size-4 text-muted" /> Extracted text
            </h2>
            <span className="text-[11px] text-muted">{[...doc.textPreview].length.toLocaleString()} characters shown</span>
          </div>
          {doc.textPreview ? (
            <pre className="scroll-thin max-h-[560px] flex-1 overflow-auto whitespace-pre-wrap break-words px-4 py-3 font-sans text-[12.5px] leading-relaxed text-ink-soft">
              {doc.textPreview}
            </pre>
          ) : (
            <EmptyState
              icon={<FileText className="size-4" />}
              title="No readable text"
              description="Text extraction returned nothing for this file. If it is a scan, OCR is required."
            />
          )}
        </Card>

        {/* Analysis */}
        <Card className="flex min-h-[520px] flex-col">
          <div className="border-b border-line px-4 py-3">
            <Segmented<Tab>
              value={tab === 'text' ? 'summary' : tab}
              onChange={setTab}
              size="sm"
              options={[
                { value: 'summary', label: 'Summary' },
                { value: 'concepts', label: 'Topics' },
                { value: 'definitions', label: 'Definitions' },
                { value: 'questions', label: 'Exam Qs' },
                ...(analysis?.chapters.length ? [{ value: 'chapters' as Tab, label: 'Chapters' }] : []),
              ]}
            />
          </div>

          <div className="scroll-thin flex-1 overflow-y-auto px-4 py-4">
            {!analysis ? (
              needsOcr ? (
                <EmptyState
                  icon={<FileText className="size-4" />}
                  title="Analysis unavailable"
                  description="There is no readable text to analyse. Try a text-based document."
                />
              ) : (
                <EmptyState
                  icon={<Sparkles className="size-4" />}
                  title="Analyse this document"
                  description="Generate a summary, main topics, important concepts, definitions and likely exam questions."
                  action={
                    <Button loading={analysing} onClick={() => void analyse()} icon={<Sparkles className="size-4" />}>
                      Analyse with AI
                    </Button>
                  }
                />
              )
            ) : tab === 'summary' ? (
              <div className="space-y-4">
                <p className="text-[13.5px] leading-relaxed text-ink-soft">{analysis.summary || 'No summary was returned.'}</p>
                {analysis.keyPoints.length ? (
                  <div>
                    <h3 className="text-[12px] font-semibold uppercase tracking-wide text-muted">Important points</h3>
                    <ul className="mt-2 space-y-1.5">
                      {analysis.keyPoints.map((point, i) => (
                        <li key={i} className="flex gap-2 text-[13px] text-ink-soft">
                          <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" />
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {analysis.concepts.length ? (
                  <div>
                    <h3 className="text-[12px] font-semibold uppercase tracking-wide text-muted">Key concepts</h3>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {analysis.concepts.map((concept) => (
                        <span key={concept} className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[11.5px] text-ink-soft">
                          {concept}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : tab === 'concepts' ? (
              <div className="space-y-3">
                <h3 className="text-[12px] font-semibold uppercase tracking-wide text-muted">Main topics</h3>
                {analysis.topics.length ? (
                  <ul className="space-y-1.5">
                    {analysis.topics.map((topic, i) => (
                      <li key={topic} className="flex items-start gap-2.5 rounded-lg border border-line bg-surface-2/50 px-3 py-2 text-[13px] text-ink-soft">
                        <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded bg-primary-soft text-[10px] font-semibold text-primary">
                          {i + 1}
                        </span>
                        {topic}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13px] text-muted">No topics were identified.</p>
                )}
              </div>
            ) : tab === 'definitions' ? (
              analysis.definitions.length ? (
                <dl className="space-y-2.5">
                  {analysis.definitions.map((definition) => (
                    <div key={definition.term} className="rounded-lg border border-line bg-surface-2/50 px-3 py-2.5">
                      <dt className="text-[12.5px] font-semibold text-ink">{definition.term}</dt>
                      <dd className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{definition.meaning}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-[13px] text-muted">No explicit definitions were found in this document.</p>
              )
            ) : tab === 'questions' ? (
              analysis.examQuestions.length ? (
                <ol className="space-y-2">
                  {analysis.examQuestions.map((question, i) => (
                    <li key={i} className="flex gap-2.5 rounded-lg border border-line bg-surface-2/50 px-3 py-2 text-[13px] text-ink-soft">
                      <span className="shrink-0 font-semibold text-primary">Q{i + 1}</span>
                      {question}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-[13px] text-muted">No exam questions were generated.</p>
              )
            ) : analysis.chapters.length ? (
              <div className="space-y-3">
                {analysis.chapters.map((chapter) => (
                  <div key={chapter.title} className="rounded-lg border border-line bg-surface-2/50 px-3 py-2.5">
                    <p className="text-[13px] font-semibold text-ink">{chapter.title}</p>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{chapter.summary}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-muted">No chapter structure was detected.</p>
            )}

            {analysing ? (
              <p className="mt-4 flex items-center gap-2 text-[12px] text-muted">
                <Loader2 className="size-3.5 animate-spin" /> Reading your document…
              </p>
            ) : null}
          </div>

          <div className="border-t border-line px-4 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                <Badge tone={doc.hasAnalysis ? 'success' : 'neutral'}>{doc.hasAnalysis ? 'AI analysis saved' : 'No analysis'}</Badge>
                <Badge>{doc.processingStatus.replace(/_/g, ' ')}</Badge>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/app/progress')}>
                See progress
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
