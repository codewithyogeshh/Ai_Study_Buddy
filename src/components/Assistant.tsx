import { useEffect, useRef, useState } from 'react'
import { Bot, Languages, Send, Sparkles, Trash2, X } from 'lucide-react'

import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useAiStatus } from '../hooks/useAiStatus'
import { api, errorMessage } from '../lib/api'
import { cleanAiText } from '../lib/format'
import { Markdown } from '../lib/markdown'
import type { DocSummary, Language } from '../types'
import { Badge, Spinner } from './ui/Card'
import { Button } from './ui/Button'
import { Select, Textarea } from './ui/Field'

type Context = 'general' | 'document' | 'subject'
type Turn = { role: 'user' | 'assistant'; content: string }

const MODES = [
  { value: 'simple', label: 'Simple' },
  { value: 'detailed', label: 'Detailed' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'exam', label: 'Exam answer' },
  { value: 'example', label: 'With example' },
]

export function Assistant() {
  const { user } = useAuth()
  const { error } = useToast()
  const status = useAiStatus()
  const [open, setOpen] = useState(false)
  const [context, setContext] = useState<Context>('general')
  const [documents, setDocuments] = useState<DocSummary[]>([])
  const [documentId, setDocumentId] = useState('')
  const [subject, setSubject] = useState('')
  const [mode, setMode] = useState('simple')
  const [language, setLanguage] = useState<Language>(user?.language ?? 'english')
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [turns, setTurns] = useState<Turn[]>([])
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (user?.language) setLanguage(user.language)
  }, [user?.language])

  useEffect(() => {
    if (!open || context !== 'document' || documents.length) return
    void api
      .get<{ documents: DocSummary[] }>('/documents')
      .then((data) => {
        setDocuments(data.documents)
        if (data.documents[0]) setDocumentId(data.documents[0].id)
      })
      .catch(() => undefined)
  }, [open, context, documents.length])

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns, open, busy])

  useEffect(() => {
    const toggle = () => setOpen((value) => !value)
    window.addEventListener('assistant:toggle', toggle)
    return () => window.removeEventListener('assistant:toggle', toggle)
  }, [])

  async function send() {
    const question = prompt.trim()
    if (!question || busy) return
    if (context === 'document' && !documentId) {
      error('Upload a document first, then select it as context.')
      return
    }
    setBusy(true)
    setPrompt('')
    const nextTurns: Turn[] = [...turns, { role: 'user', content: question }]
    setTurns(nextTurns)
    try {
      const data = await api.post<{ answer: string }>('/ai/explain', {
        prompt: question,
        context,
        documentId: context === 'document' ? documentId : undefined,
        subject: context === 'subject' ? subject || 'General' : undefined,
        mode,
        language,
        history: turns.slice(-6),
      })
      setTurns([...nextTurns, { role: 'assistant', content: cleanAiText(data.answer) }])
    } catch (err) {
      setTurns([...nextTurns, { role: 'assistant', content: `⚠️ ${errorMessage(err)}` }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-40 hidden items-center gap-2 rounded-full bg-primary px-4 py-3 text-[13px] font-medium text-on-primary shadow-float transition hover:bg-primary-hover sm:inline-flex"
        aria-label={open ? 'Close AI assistant' : 'Open AI assistant'}
      >
        {open ? <X className="size-4" /> : <Sparkles className="size-4" />}
        <span className="hidden sm:inline">{open ? 'Close' : 'Ask AI'}</span>
      </button>

      {open ? (
        <div className="fixed inset-x-0 bottom-0 z-40 flex h-[86dvh] flex-col rounded-t-2xl border border-line bg-bg-elevated shadow-float sm:inset-x-auto sm:bottom-20 sm:right-5 sm:h-[600px] sm:w-[420px] sm:rounded-2xl">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <Bot className="size-4" />
              </span>
              <div>
                <p className="text-[13.5px] font-semibold text-ink">Study assistant</p>
                <p className="text-[11px] text-muted">Ask anything, any time</p>
              </div>
            </div>
            <button
              onClick={() => setTurns([])}
              className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-ink"
              aria-label="Clear assistant conversation"
              title="Clear conversation"
            >
              <Trash2 className="size-4" />
            </button>
          </div>

          <div className="space-y-2 border-b border-line px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              {(['general', 'document', 'subject'] as Context[]).map((option) => (
                <button
                  key={option}
                  onClick={() => setContext(option)}
                  className={`rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium capitalize transition ${
                    context === option
                      ? 'border-primary/30 bg-primary-soft text-primary'
                      : 'border-line text-muted hover:text-ink'
                  }`}
                >
                  {option}
                </button>
              ))}
              <Badge tone={status?.configured ? 'success' : 'warn'}>
                {status?.configured ? status.model : 'AI not configured'}
              </Badge>
            </div>
            {context === 'document' ? (
              <Select value={documentId} onChange={(e) => setDocumentId(e.target.value)} aria-label="Document context">
                <option value="">Select a document…</option>
                {documents.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.filename}
                  </option>
                ))}
              </Select>
            ) : context === 'subject' ? (
              <Select value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject context">
                <option value="">General studies</option>
                {['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science', 'English', 'History'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <Select value={mode} onChange={(e) => setMode(e.target.value)} aria-label="Answer style">
                {MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
              <Select
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                aria-label="Language"
              >
                <option value="english">English</option>
                <option value="marathi">Marathi</option>
                <option value="hindi">Hindi</option>
              </Select>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 scroll-thin">
            {turns.length === 0 && !busy ? (
              <div className="rounded-xl border border-dashed border-line bg-surface-2/60 p-4">
                <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink">
                  <Sparkles className="size-3.5 text-primary" /> Try asking
                </p>
                <ul className="mt-2 space-y-1.5 text-[12px] text-muted">
                  {[
                    'Explain photosynthesis like I am a beginner',
                    'Give me 5 MCQs on the water cycle with answers',
                    'Write an exam answer on DBMS normalization',
                    'Make a 3-day revision plan for my physics exam',
                    'हडूप (Hadoop) सोप्या मराठीत समजावून सांगा',
                  ].map((example) => (
                    <li key={example}>
                      <button className="text-left hover:text-ink" onClick={() => setPrompt(example)}>
                        “{example}”
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {turns.map((turn, i) =>
              turn.role === 'user' ? (
                <div key={i} className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3 py-2 text-[13px] text-on-primary">
                  {turn.content}
                </div>
              ) : (
                <div key={i} className="max-w-[92%] rounded-2xl rounded-bl-md border border-line bg-surface px-3 py-2 text-[13px] text-ink-soft">
                  <Markdown text={turn.content} className="text-[13px]" />
                </div>
              ),
            )}

            {busy ? (
              <div className="flex items-center gap-2 text-xs text-muted">
                <Spinner />
                <span className="flex gap-1">
                  <span className="typing-dot size-1.5 rounded-full bg-primary" />
                  <span className="typing-dot size-1.5 rounded-full bg-primary" />
                  <span className="typing-dot size-1.5 rounded-full bg-primary" />
                </span>
              </div>
            ) : null}
            <div ref={endRef} />
          </div>

          <div className="border-t border-line p-3">
            <div className="flex items-end gap-2">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void send()
                  }
                }}
                rows={1}
                placeholder="Ask about a concept, ask for MCQs, exam answers…"
                className="min-h-10 resize-none py-2"
                aria-label="Message to the AI assistant"
              />
              <Button onClick={() => void send()} loading={busy} aria-label="Send message" className="h-10 px-3">
                {busy ? null : <Send className="size-4" />}
              </Button>
            </div>
            <p className="mt-1.5 flex items-center gap-1 text-[10.5px] text-muted">
              <Languages className="size-3" /> Answers can be in English, Marathi or Hindi. AI can make mistakes — verify
              important facts.
            </p>
          </div>
        </div>
      ) : null}
    </>
  )
}
