import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import {
  BookOpen,
  Loader2,
  MessageSquarePlus,
  Mic,
  MicOff,
  Send,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react'

import { Button } from '../components/ui/Button'
import { Alert, Badge, Card, EmptyState, PageHeader, Skeleton } from '../components/ui/Card'
import { Select, Textarea } from '../components/ui/Field'
import { Modal } from '../components/ui/Modal'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useAiStatus } from '../hooks/useAiStatus'
import { useSpeechToText, useTextToSpeech } from '../hooks/useSpeech'
import { api, errorMessage } from '../lib/api'
import { cleanAiText, relativeTime } from '../lib/format'
import { Markdown } from '../lib/markdown'
import type { Chat as ChatType, ChatListItem, ChatMessage, DocSummary, Language } from '../types'

const MODES = [
  { value: 'simple', label: 'Simple explanation' },
  { value: 'detailed', label: 'Detailed explanation' },
  { value: 'beginner', label: 'Explain like a beginner' },
  { value: 'exam', label: 'Exam answer format' },
  { value: 'marathi', label: 'Marathi explanation' },
  { value: 'english', label: 'English explanation' },
  { value: 'example', label: 'Give an example' },
]

export function Chat() {
  const { user } = useAuth()
  const { error: toastError, success } = useToast()
  const ai = useAiStatus()
  const [params, setParams] = useSearchParams()
  const documentId = params.get('documentId') ?? ''

  const [documents, setDocuments] = useState<DocSummary[] | null>(null)
  const [chats, setChats] = useState<ChatListItem[]>([])
  const [chat, setChat] = useState<ChatType | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [question, setQuestion] = useState('')
  const [mode, setMode] = useState('simple')
  const [language, setLanguage] = useState<Language>(user?.language ?? 'english')
  const [busy, setBusy] = useState(false)
  const [loadingChat, setLoadingChat] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [speakingId, setSpeakingId] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const tts = useTextToSpeech()

  const speech = useSpeechToText(language, (transcript) => {
    setQuestion((current) => (current ? `${current} ${transcript}` : transcript))
  })

  const selectedDoc = useMemo(() => documents?.find((doc) => doc.id === documentId) ?? null, [documents, documentId])

  useEffect(() => {
    api
      .get<{ documents: DocSummary[] }>('/documents')
      .then((data) => {
        setDocuments(data.documents)
        if (!documentId && data.documents[0]) {
          setParams({ documentId: data.documents[0].id }, { replace: true })
        }
      })
      .catch((err) => {
        setDocuments([])
        toastError(errorMessage(err))
      })
  }, [documentId, setParams, toastError])

  const loadChats = useCallback(async (docId: string) => {
    if (!docId) return
    try {
      const data = await api.get<{ chats: ChatListItem[] }>(`/chats?documentId=${encodeURIComponent(docId)}`)
      setChats(data.chats)
    } catch {
      setChats([])
    }
  }, [])

  useEffect(() => {
    void loadChats(documentId)
    setChat(null)
    setMessages([])
  }, [documentId, loadChats])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, busy])

  async function openChat(id: string) {
    setLoadingChat(true)
    try {
      const data = await api.get<{ chat: ChatType }>(`/chats/${id}`)
      setChat(data.chat)
      setMessages(data.chat.messages)
      setMode(data.chat.mode || 'simple')
    } catch (err) {
      toastError(errorMessage(err))
    } finally {
      setLoadingChat(false)
    }
  }

  function newChat() {
    setChat(null)
    setMessages([])
    setQuestion('')
  }

  async function send() {
    const text = question.trim()
    if (!text || busy) return
    if (!documentId) {
      toastError('Select a document to chat with.')
      return
    }
    setBusy(true)
    setQuestion('')
    const optimistic: ChatMessage = {
      id: `local-${Date.now()}`,
      role: 'user',
      content: text,
      at: new Date().toISOString(),
    }
    setMessages((list) => [...list, optimistic])
    try {
      const data = await api.post<{ chat: ChatType; answer: ChatMessage }>('/ai/chat', {
        chatId: chat?.id,
        documentId,
        question: text,
        mode,
        language,
      })
      setChat(data.chat)
      setMessages(data.chat.messages)
      void loadChats(documentId)
    } catch (err) {
      setMessages((list) => list.filter((m) => m.id !== optimistic.id))
      setQuestion(text)
      toastError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function clearChat() {
    if (!chat) {
      setMessages([])
      return
    }
    try {
      await api.del(`/chats/${chat.id}/messages`)
      setMessages([])
      success('Conversation cleared.')
    } catch (err) {
      toastError(errorMessage(err))
    }
  }

  async function deleteChat() {
    if (!chat) return
    try {
      await api.del(`/chats/${chat.id}`)
      setChat(null)
      setMessages([])
      setConfirmDelete(false)
      void loadChats(documentId)
      success('Chat deleted.')
    } catch (err) {
      toastError(errorMessage(err))
    }
  }

  function speak(message: ChatMessage) {
    if (speakingId === message.id) {
      tts.stop()
      setSpeakingId(null)
      return
    }
    tts.speak(message.content, language)
    setSpeakingId(message.id)
  }

  if (documents && documents.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="AI chat" description="Ask questions and get answers grounded in your own study material." />
        <Card>
          <EmptyState
            icon={<BookOpen className="size-4" />}
            title="Upload a document to start chatting"
            description="The assistant answers from your material and cites the page it used. Without a document there is nothing to ground answers in."
            action={
              <Link to="/app/documents" className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-on-primary">
                Upload study material
              </Link>
            }
          />
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="AI chat"
        description="Grounded in your document. If the answer is not in it, the assistant says so."
        action={
          <Button variant="secondary" onClick={newChat} icon={<MessageSquarePlus className="size-4" />}>
            New chat
          </Button>
        }
      />

      {ai && !ai.configured ? <Alert tone="warn">{ai.message}</Alert> : null}

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        {/* Chat history */}
        <Card className="hidden max-h-[640px] flex-col overflow-hidden lg:flex">
          <p className="border-b border-line px-3 py-2.5 text-[11.5px] font-semibold uppercase tracking-wide text-muted">
            Recent chats
          </p>
          <div className="scroll-thin flex-1 overflow-y-auto p-1.5">
            {chats.length === 0 ? (
              <p className="px-2.5 py-3 text-[12px] text-muted">No chats yet for this document.</p>
            ) : (
              <ul className="space-y-0.5">
                {chats.map((item) => (
                  <li key={item.id}>
                    <button
                      onClick={() => void openChat(item.id)}
                      className={`w-full rounded-lg px-2.5 py-2 text-left transition ${
                        chat?.id === item.id ? 'bg-primary-soft' : 'hover:bg-surface-2'
                      }`}
                    >
                      <p className="line-clamp-2 text-[12px] font-medium leading-snug text-ink">{item.title}</p>
                      <p className="mt-0.5 text-[10.5px] text-muted">
                        {item.messageCount} messages · {relativeTime(item.updatedAt)}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        {/* Conversation */}
        <Card className="flex min-h-[640px] flex-col overflow-hidden">
          <div className="grid gap-2 border-b border-line px-4 py-3 sm:grid-cols-[1.4fr_1fr_0.9fr]">
            <Select
              value={documentId}
              onChange={(e) => setParams({ documentId: e.target.value })}
              aria-label="Document"
              className="h-9 text-[12.5px]"
            >
              {(documents ?? []).map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.filename}
                </option>
              ))}
            </Select>
            <Select value={mode} onChange={(e) => setMode(e.target.value)} aria-label="Chat mode" className="h-9 text-[12.5px]">
              {MODES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              aria-label="Language"
              className="h-9 text-[12.5px]"
            >
              <option value="english">English</option>
              <option value="marathi">Marathi</option>
              <option value="hindi">Hindi</option>
            </Select>
          </div>

          <div className="scroll-thin flex-1 space-y-4 overflow-y-auto px-4 py-5">
            {loadingChat ? (
              <div className="space-y-3">
                <Skeleton className="h-14 w-2/3" />
                <Skeleton className="ml-auto h-10 w-1/2" />
              </div>
            ) : messages.length === 0 ? (
              <div className="mx-auto max-w-md py-8 text-center">
                <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <BookOpen className="size-5" />
                </div>
                <h3 className="mt-3 text-[14px] font-semibold text-ink">
                  Ask anything about {selectedDoc ? `“${selectedDoc.filename}”` : 'your document'}
                </h3>
                <p className="mt-1.5 text-[12.5px] text-muted">
                  The assistant reads the extracted text and cites the page it used. It will tell you when the document
                  does not cover something.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                  {['Summarise the main argument', 'Define the key terms', 'What are likely exam questions?', 'Explain this simply'].map(
                    (suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => setQuestion(suggestion)}
                        className="rounded-full border border-line bg-surface px-2.5 py-1 text-[11.5px] text-ink-soft transition hover:border-line-strong hover:text-ink"
                      >
                        {suggestion}
                      </button>
                    ),
                  )}
                </div>
              </div>
            ) : (
              messages.map((message) =>
                message.role === 'user' ? (
                  <div key={message.id} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-[13px] text-on-primary">
                      {message.content}
                    </div>
                  </div>
                ) : (
                  <div key={message.id} className="max-w-[92%]">
                    <div className="rounded-2xl rounded-bl-md border border-line bg-surface px-3.5 py-2.5">
                      <Markdown text={cleanAiText(message.content)} className="text-[13px]" />
                      {message.sources && message.sources.length > 0 ? (
                        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-line pt-2">
                          <span className="text-[10.5px] font-medium uppercase tracking-wide text-muted">Sources</span>
                          {message.sources.map((source, i) => (
                            <span
                              key={i}
                              className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[10.5px] text-ink-soft"
                            >
                              {source.page ? `Page ${source.page}` : source.note || 'Document'}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {message.inDocument === false ? (
                        <p className="mt-2 rounded-md bg-warn-soft px-2 py-1 text-[11px] text-warn">
                          Not found in the document — general knowledge below should be verified.
                        </p>
                      ) : null}
                    </div>
                    <div className="mt-1 flex items-center gap-2 pl-0.5">
                      <button
                        onClick={() => speak(message)}
                        className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[10.5px] text-muted hover:text-ink"
                        aria-label="Read answer aloud"
                      >
                        {speakingId === message.id && tts.speaking ? <VolumeX className="size-3" /> : <Volume2 className="size-3" />}
                        {speakingId === message.id && tts.speaking ? 'Stop' : 'Read aloud'}
                      </button>
                      <span className="text-[10.5px] text-muted">{relativeTime(message.at)}</span>
                    </div>
                  </div>
                ),
              )
            )}

            {busy ? (
              <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2.5 text-[12px] text-muted">
                <Loader2 className="size-3.5 animate-spin text-primary" />
                Reading your document…
              </div>
            ) : null}
            <div ref={endRef} />
          </div>

          <div className="border-t border-line px-3 py-3">
            <div className="flex items-end gap-2">
              <div className="relative flex-1">
                <Textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void send()
                    }
                  }}
                  placeholder={speech.listening ? 'Listening… speak your question' : 'Ask about this document…'}
                  rows={1}
                  className="min-h-11 resize-none py-2.5 pr-10 text-[13px]"
                  aria-label="Your question"
                />
                {speech.supported ? (
                  <button
                    onClick={() => (speech.listening ? speech.stop() : speech.start())}
                    className={`absolute bottom-1.5 right-1.5 rounded-md p-1.5 transition ${
                      speech.listening ? 'bg-bad-soft text-bad' : 'text-muted hover:bg-surface-2 hover:text-ink'
                    }`}
                    aria-label={speech.listening ? 'Stop dictation' : 'Dictate a question'}
                    title={speech.listening ? 'Stop dictation' : 'Speak your question'}
                  >
                    {speech.listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                  </button>
                ) : null}
              </div>
              <Button onClick={() => void send()} loading={busy} className="h-11 px-4" aria-label="Send question">
                {busy ? null : <Send className="size-4" />}
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10.5px] text-muted">Enter to send · Shift+Enter for a new line</p>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => void clearChat()}>
                  Clear
                </Button>
                <Button variant="ghost" size="sm" disabled={!chat} onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="size-3.5" /> Delete chat
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {chat ? (
        <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-muted">
          <Badge tone="primary">{chat.title}</Badge>
          <span>Saved automatically to your chat history.</span>
        </div>
      ) : null}

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this chat?"
        description="The conversation history will be removed permanently."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void deleteChat()}>
              Delete chat
            </Button>
          </>
        }
      />
    </div>
  )
}
