import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import {
  BookOpenCheck,
  Check,
  Copy,
  FileText,
  Loader2,
  Pencil,
  Printer,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from 'lucide-react'

import { Button } from '../components/ui/Button'
import { Alert, Badge, Card, EmptyState, PageHeader, Skeleton } from '../components/ui/Card'
import { Input, Label, Select, Textarea } from '../components/ui/Field'
import { Modal } from '../components/ui/Modal'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useAiStatus } from '../hooks/useAiStatus'
import { api, errorMessage } from '../lib/api'
import { copyText, printDocument } from '../lib/export'
import { relativeTime } from '../lib/format'
import { Markdown } from '../lib/markdown'
import type { DocSummary, Language, Note } from '../types'

const STYLES = [
  { value: 'short', label: 'Short notes' },
  { value: 'detailed', label: 'Detailed notes' },
  { value: 'exam', label: 'Exam-oriented' },
  { value: 'chapter', label: 'Chapter-wise' },
  { value: 'bullet', label: 'Bullet points' },
  { value: 'revision', label: 'Revision notes' },
  { value: 'definitions', label: 'Important definitions' },
  { value: 'proscons', label: 'Advantages & disadvantages' },
  { value: 'examples', label: 'With examples' },
  { value: 'takeaways', label: 'Key takeaways' },
]

type Draft = { title: string; content: string; style: string; language: Language; documentId: string }

export function Notes() {
  const { user } = useAuth()
  const { success, error: toastError } = useToast()
  const ai = useAiStatus()
  const [params, setParams] = useSearchParams()
  const initialDoc = params.get('documentId') ?? ''

  const [documents, setDocuments] = useState<DocSummary[] | null>(null)
  const [notes, setNotes] = useState<Note[] | null>(null)
  const [documentId, setDocumentId] = useState(initialDoc)
  const [style, setStyle] = useState('detailed')
  const [language, setLanguage] = useState<Language>(user?.language ?? 'english')
  const [focus, setFocus] = useState('')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [selected, setSelected] = useState<Note | null>(null)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<Note | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const [docsData, notesData] = await Promise.all([
        api.get<{ documents: DocSummary[] }>('/documents'),
        api.get<{ notes: Note[] }>('/notes'),
      ])
      setDocuments(docsData.documents)
      setNotes(notesData.notes)
      setDocumentId((current) => current || docsData.documents[0]?.id || '')
    } catch (err) {
      setError(errorMessage(err))
      setDocuments([])
      setNotes([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (initialDoc) {
      setDocumentId(initialDoc)
      setParams({}, { replace: true })
    }
  }, [initialDoc, setParams])

  async function generate(regenerate = false) {
    if (!documentId) {
      toastError('Choose a document first.')
      return
    }
    setGenerating(true)
    setError('')
    try {
      const data = await api.post<{ title: string; content: string }>('/ai/generate-notes', {
        documentId,
        style,
        language,
        focus: focus.trim() || undefined,
      })
      setDraft({ title: data.title, content: data.content, style, language, documentId })
      setSelected(null)
      setEditing(false)
      if (regenerate) success('New version generated.')
    } catch (err) {
      setError(errorMessage(err))
      toastError(errorMessage(err))
    } finally {
      setGenerating(false)
    }
  }

  async function saveDraft() {
    if (!draft) return
    setSaving(true)
    try {
      const data = await api.post<{ note: Note }>('/notes', {
        documentId: draft.documentId,
        title: draft.title,
        content: draft.content,
        language: draft.language,
        style: draft.style,
      })
      setNotes((list) => [data.note, ...(list ?? [])])
      setSelected(data.note)
      setDraft(null)
      success('Notes saved.')
    } catch (err) {
      toastError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  function startEdit(note: Note) {
    setSelected(note)
    setDraft(null)
    setEditTitle(note.title)
    setEditContent(note.content)
    setEditing(true)
  }

  async function saveEdit() {
    if (!selected) return
    if (!editTitle.trim() || !editContent.trim()) {
      toastError('A note needs a title and content.')
      return
    }
    setSaving(true)
    try {
      const data = await api.put<{ note: Note }>(`/notes/${selected.id}`, {
        title: editTitle.trim(),
        content: editContent,
      })
      setSelected(data.note)
      setNotes((list) => (list ?? []).map((note) => (note.id === data.note.id ? data.note : note)))
      setEditing(false)
      success('Note updated.')
    } catch (err) {
      toastError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function deleteNote(note: Note) {
    try {
      await api.del(`/notes/${note.id}`)
      setNotes((list) => (list ?? []).filter((item) => item.id !== note.id))
      if (selected?.id === note.id) setSelected(null)
      if (draft) setDraft(null)
      setConfirmDelete(null)
      success('Note deleted.')
    } catch (err) {
      toastError(errorMessage(err))
    }
  }

  async function doCopy(text: string) {
    await copyText(text)
    setCopied(true)
    success('Copied to clipboard.')
    window.setTimeout(() => setCopied(false), 1800)
  }

  const current = draft ?? selected
  const hasDocuments = Boolean(documents && documents.length > 0)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notes"
        description="Generate study notes from your material, then edit, save and export them."
      />

      {error ? <Alert tone="error">{error}</Alert> : null}
      {ai && !ai.configured ? <Alert tone="warn">{ai.message}</Alert> : null}

      {!hasDocuments && documents ? (
        <Card>
          <EmptyState
            icon={<FileText className="size-4" />}
            title="Upload a document first"
            description="Notes are generated from the text of a document you own."
            action={
              <Link to="/app/documents" className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-on-primary">
                Upload study material
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          {/* Generator + list */}
          <div className="space-y-4">
            <Card className="p-4">
              <h2 className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ink">
                <Wand2 className="size-4 text-primary" /> Generate notes
              </h2>
              <div className="mt-3 space-y-3">
                <div>
                  <Label htmlFor="note-doc">Document</Label>
                  <Select id="note-doc" value={documentId} onChange={(e) => setDocumentId(e.target.value)}>
                    {(documents ?? []).map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.filename}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="note-style">Note style</Label>
                  <Select id="note-style" value={style} onChange={(e) => setStyle(e.target.value)}>
                    {STYLES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="note-language">Language</Label>
                  <Select id="note-language" value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
                    <option value="english">English</option>
                    <option value="marathi">Marathi</option>
                    <option value="hindi">Hindi</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="note-focus" hint="optional">
                    Focus on
                  </Label>
                  <Input
                    id="note-focus"
                    value={focus}
                    onChange={(e) => setFocus(e.target.value)}
                    placeholder="e.g. Unit 3 only, numericals"
                    maxLength={300}
                  />
                </div>
                <Button className="w-full" loading={generating} onClick={() => void generate()} icon={<Sparkles className="size-4" />}>
                  Generate notes
                </Button>
              </div>
            </Card>

            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                <h2 className="text-[12.5px] font-semibold text-ink">Saved notes</h2>
                <span className="text-[11px] text-muted">{notes?.length ?? 0}</span>
              </div>
              <div className="scroll-thin max-h-[420px] overflow-y-auto p-1.5">
                {notes === null ? (
                  <div className="space-y-2 p-2">
                    <Skeleton className="h-12" />
                    <Skeleton className="h-12" />
                  </div>
                ) : notes.length === 0 ? (
                  <p className="px-3 py-6 text-center text-[12px] text-muted">No saved notes yet.</p>
                ) : (
                  <ul className="space-y-0.5">
                    {notes.map((note) => (
                      <li key={note.id}>
                        <button
                          onClick={() => {
                            setSelected(note)
                            setDraft(null)
                            setEditing(false)
                          }}
                          className={`w-full rounded-lg px-2.5 py-2 text-left transition ${
                            selected?.id === note.id && !draft ? 'bg-primary-soft' : 'hover:bg-surface-2'
                          }`}
                        >
                          <p className="line-clamp-1 text-[12.5px] font-medium text-ink">{note.title}</p>
                          <p className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-muted">
                            <span className="capitalize">{note.style}</span>
                            <span aria-hidden>·</span>
                            <span className="capitalize">{note.language}</span>
                            <span aria-hidden>·</span>
                            <span>{relativeTime(note.updatedAt)}</span>
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          </div>

          {/* Viewer / editor */}
          <Card className="flex min-h-[560px] flex-col overflow-hidden">
            {!current ? (
              <EmptyState
                className="flex-1"
                icon={<BookOpenCheck className="size-4" />}
                title="No note open"
                description="Generate notes from a document, or pick a saved note to read and edit."
                action={
                  hasDocuments ? (
                    <Button loading={generating} onClick={() => void generate()} icon={<Sparkles className="size-4" />}>
                      Generate my first note
                    </Button>
                  ) : undefined
                }
              />
            ) : editing && selected ? (
              <>
                <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
                  <h2 className="text-[13px] font-semibold text-ink">Editing note</h2>
                  <div className="flex gap-1.5">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(false)} icon={<X className="size-3.5" />}>
                      Cancel
                    </Button>
                    <Button size="sm" loading={saving} onClick={() => void saveEdit()} icon={<Save className="size-3.5" />}>
                      Save changes
                    </Button>
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div>
                    <Label htmlFor="edit-title">Title</Label>
                    <Input id="edit-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} maxLength={200} />
                  </div>
                  <div className="flex flex-1 flex-col">
                    <Label htmlFor="edit-content" hint="Markdown supported">
                      Content
                    </Label>
                    <Textarea
                      id="edit-content"
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="scroll-thin min-h-[380px] flex-1 font-mono text-[12.5px] leading-relaxed"
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
                  <div className="min-w-0">
                    <h2 className="truncate text-[13.5px] font-semibold text-ink">{current.title}</h2>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge tone="primary">{draft ? 'Draft — not saved' : (current as Note).style}</Badge>
                      <Badge>{current.language}</Badge>
                      {draft ? null : <span className="text-[10.5px] text-muted">Updated {relativeTime((current as Note).updatedAt)}</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {draft ? (
                      <>
                        <Button size="sm" variant="secondary" loading={generating} onClick={() => void generate(true)} icon={<RefreshCw className="size-3.5" />}>
                          Regenerate
                        </Button>
                        <Button size="sm" loading={saving} onClick={() => void saveDraft()} icon={<Save className="size-3.5" />}>
                          Save
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="secondary" onClick={() => startEdit(current as Note)} icon={<Pencil className="size-3.5" />}>
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(current as Note)} icon={<Trash2 className="size-3.5" />}>
                          Delete
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void doCopy(current.content)}
                      icon={copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    >
                      Copy
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const ok = printDocument(current.title, current.content, `${current.language} notes · AI Study Buddy`)
                        if (!ok) toastError('Allow pop-ups to export notes as PDF.')
                      }}
                      icon={<Printer className="size-3.5" />}
                    >
                      PDF
                    </Button>
                  </div>
                </div>
                <div className="scroll-thin flex-1 overflow-y-auto px-5 py-4">
                  <Markdown text={current.content} className="text-[13.5px] text-ink-soft" />
                </div>
                <div className="border-t border-line px-4 py-2.5">
                  <p className="flex items-center gap-1.5 text-[10.5px] text-muted">
                    <Loader2 className={`size-3 ${generating ? 'animate-spin' : 'hidden'}`} />
                    {draft
                      ? 'Save this draft to keep it in your notes library.'
                      : 'PDF export opens a print dialog — choose “Save as PDF”.'}
                  </p>
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Delete this note?"
        description="This cannot be undone."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => confirmDelete && void deleteNote(confirmDelete)}>
              Delete note
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-ink-soft">{confirmDelete?.title}</p>
      </Modal>
    </div>
  )
}
