import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  Search,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react'

import { Button } from '../components/ui/Button'
import { Alert, Badge, Card, EmptyState, PageHeader, Progress, Skeleton } from '../components/ui/Card'
import { Input } from '../components/ui/Field'
import { Modal } from '../components/ui/Modal'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { api, errorMessage, getToken } from '../lib/api'
import { formatBytes, relativeTime } from '../lib/format'
import type { DocSummary } from '../types'

const MAX_BYTES = 15 * 1024 * 1024
const ACCEPTED = ['.pdf', '.txt', '.docx']

type UploadState = { name: string; progress: number; stage: 'uploading' | 'analysing' | 'done' | 'error'; message?: string }

/** XHR so the upload progress bar reflects real bytes sent. */
function uploadDocument(
  file: File,
  onProgress: (percent: number) => void,
): Promise<{ document: DocSummary; analysisError?: string; warning?: string }> {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    form.append('file', file)
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/documents/upload')
    const token = getToken()
    if (token) xhr.setRequestHeader('authorization', `Bearer ${token}`)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100))
    }
    xhr.onload = () => {
      let data: { document?: DocSummary; error?: string; analysisError?: string; warning?: string } = {}
      try {
        data = JSON.parse(xhr.responseText)
      } catch {
        /* ignore */
      }
      if (xhr.status >= 200 && xhr.status < 300 && data.document) resolve(data as { document: DocSummary })
      else reject(new Error(data.error ?? `Upload failed (${xhr.status}).`))
    }
    xhr.onerror = () => reject(new Error('Upload failed. Check your connection and try again.'))
    xhr.send(form)
  })
}

export function Documents() {
  const { user } = useAuth()
  const { success, error: toastError } = useToast()
  const [documents, setDocuments] = useState<DocSummary[] | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [upload, setUpload] = useState<UploadState | null>(null)
  const [dragging, setDragging] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<DocSummary | null>(null)
  const [deleting, setDeleting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ documents: DocSummary[] }>('/documents')
      setDocuments(data.documents)
      setError('')
    } catch (err) {
      setError(errorMessage(err))
      setDocuments([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleFile(file: File) {
    if (!user) return
    const ext = `.${file.name.toLowerCase().split('.').pop()}`
    if (!ACCEPTED.includes(ext)) {
      toastError('Only PDF, TXT and DOCX files are supported.')
      return
    }
    if (file.size > MAX_BYTES) {
      toastError('That file is larger than the 15 MB limit.')
      return
    }
    setUpload({ name: file.name, progress: 0, stage: 'uploading' })
    try {
      const result = await uploadDocument(file, (percent) => {
        setUpload((prev) => (prev ? { ...prev, progress: percent, stage: percent >= 100 ? 'analysing' : 'uploading' } : prev))
      })
      setUpload((prev) => (prev ? { ...prev, progress: 100, stage: 'done' } : prev))
      await load()
      if (result.document.processingStatus === 'needs_ocr') {
        toastError('That PDF looks scanned. Text extraction found almost nothing; see the document page for details.')
      } else if (result.analysisError) {
        toastError(`Uploaded, but AI analysis failed: ${result.analysisError}`)
      } else {
        success(`${file.name} analysed and ready.`)
      }
      window.setTimeout(() => setUpload(null), 2400)
    } catch (err) {
      setUpload((prev) => (prev ? { ...prev, stage: 'error', message: errorMessage(err) } : prev))
      toastError(errorMessage(err))
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void handleFile(file)
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await api.del(`/documents/${pendingDelete.id}`)
      setDocuments((list) => (list ?? []).filter((doc) => doc.id !== pendingDelete.id))
      success('Document deleted.')
      setPendingDelete(null)
    } catch (err) {
      toastError(errorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  const filtered = (documents ?? []).filter((doc) => doc.filename.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="space-y-6">
      <PageHeader
        title="My documents"
        description="Upload study material once, then reuse it for notes, chat, quizzes, viva and flashcards."
        action={
          <Button onClick={() => inputRef.current?.click()} icon={<UploadCloud className="size-4" />}>
            Upload file
          </Button>
        }
      />

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt,.docx,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleFile(file)
          e.target.value = ''
        }}
      />

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`rounded-2xl border-2 border-dashed p-6 text-center transition-colors sm:p-8 ${
          dragging ? 'border-primary bg-primary-soft/60' : 'border-line bg-surface'
        }`}
      >
        {upload ? (
          <div className="mx-auto max-w-md text-left">
            <div className="flex items-center gap-2.5">
              {upload.stage === 'done' ? (
                <CheckCircle2 className="size-4 shrink-0 text-ok" />
              ) : upload.stage === 'error' ? (
                <AlertCircle className="size-4 shrink-0 text-bad" />
              ) : (
                <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
              )}
              <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{upload.name}</p>
              <span className="text-[11.5px] tabular-nums text-muted">
                {upload.stage === 'analysing' ? 'Analysing…' : upload.stage === 'done' ? 'Done' : `${upload.progress}%`}
              </span>
            </div>
            <Progress
              value={upload.stage === 'analysing' ? 100 : upload.progress}
              className="mt-2.5"
              tone={upload.stage === 'error' ? 'danger' : upload.stage === 'done' ? 'success' : 'primary'}
            />
            <p className="mt-2 text-[11.5px] text-muted">
              {upload.stage === 'error'
                ? upload.message
                : upload.stage === 'analysing'
                  ? 'Extracting text and building your summary, topics and questions. This can take a few seconds.'
                  : upload.stage === 'done'
                    ? 'Saved. Opening options below.'
                    : 'Uploading your file…'}
            </p>
          </div>
        ) : (
          <>
            <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <UploadCloud className="size-5" />
            </div>
            <p className="mt-3 text-[14px] font-medium text-ink">Drag and drop your study material</p>
            <p className="mt-1 text-[12.5px] text-muted">PDF, DOCX or TXT · up to 15 MB · scans without a text layer cannot be read</p>
            <Button variant="secondary" size="sm" className="mt-4" onClick={() => inputRef.current?.click()}>
              Browse files
            </Button>
          </>
        )}
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {/* List */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="text-[14px] font-semibold text-ink">
            {documents === null ? 'Loading…' : `${documents.length} document${documents.length === 1 ? '' : 's'}`}
          </h2>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search documents"
              className="h-9 pl-8 text-[13px]"
              aria-label="Search documents"
            />
            {query ? (
              <button
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted hover:text-ink"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
        </div>

        {documents === null ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<FileText className="size-4" />}
            title={documents.length === 0 ? 'No documents yet' : 'No documents match your search'}
            description={
              documents.length === 0
                ? 'Upload your first PDF, DOCX or TXT file to get an AI summary, notes, quizzes and more.'
                : 'Try a different filename.'
            }
            action={
              documents.length === 0 ? (
                <Button onClick={() => inputRef.current?.click()} icon={<UploadCloud className="size-4" />}>
                  Upload a document
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {filtered.map((doc) => (
              <li key={doc.id} className="group flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2/50">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-[10px] font-semibold uppercase text-muted">
                  {doc.fileType}
                </span>
                <Link to={`/app/documents/${doc.id}`} className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium text-ink group-hover:text-primary">{doc.filename}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-muted">
                    <span>{formatBytes(doc.fileSize)}</span>
                    <span aria-hidden>·</span>
                    <span>{doc.pageCount} pages</span>
                    <span aria-hidden>·</span>
                    <span>{doc.wordCount.toLocaleString()} words</span>
                    <span aria-hidden>·</span>
                    <span>{relativeTime(doc.uploadDate)}</span>
                  </p>
                </Link>
                <div className="flex shrink-0 items-center gap-1.5">
                  {doc.processingStatus === 'needs_ocr' ? (
                    <Badge tone="warn">Needs OCR</Badge>
                  ) : doc.processingStatus === 'empty' ? (
                    <Badge tone="warn">No text</Badge>
                  ) : doc.hasAnalysis ? (
                    <Badge tone="success">Analysed</Badge>
                  ) : (
                    <Badge>Ready</Badge>
                  )}
                  <button
                    onClick={() => setPendingDelete(doc)}
                    className="rounded-md p-1.5 text-muted transition hover:bg-bad-soft hover:text-bad"
                    aria-label={`Delete ${doc.filename}`}
                    title="Delete document"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title="Delete this document?"
        description="This also removes chats, quizzes, flashcards and notes created from it. Uploaded files cannot be recovered."
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleting} onClick={() => void confirmDelete()}>
              Delete document
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-ink-soft">{pendingDelete?.filename}</p>
      </Modal>
    </div>
  )
}
