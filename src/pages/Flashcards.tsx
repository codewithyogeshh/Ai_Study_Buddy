import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  Check,
  FileText,
  Layers,
  RotateCw,
  Save,
  Shuffle,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'

import { Button, buttonClasses } from '../components/ui/Button'
import { Alert, Badge, Card, EmptyState, PageHeader, Progress, Skeleton } from '../components/ui/Card'
import { Input, Label, Select } from '../components/ui/Field'
import { Modal } from '../components/ui/Modal'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useAiStatus } from '../hooks/useAiStatus'
import { api, errorMessage } from '../lib/api'
import { formatDate } from '../lib/format'
import type { Deck, DocSummary, Flashcard, Language } from '../types'

export function Flashcards() {
  const { id } = useParams<{ id?: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { success, error: toastError } = useToast()
  const ai = useAiStatus()
  const [params] = useSearchParams()

  const [documents, setDocuments] = useState<DocSummary[] | null>(null)
  const [decks, setDecks] = useState<Deck[] | null>(null)
  const [documentId, setDocumentId] = useState(params.get('documentId') ?? '')
  const [count, setCount] = useState(10)
  const [chapter, setChapter] = useState('')
  const [language, setLanguage] = useState<Language>(user?.language ?? 'english')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<{ title: string; cards: Flashcard[] } | null>(null)
  const [error, setError] = useState('')
  const [pendingDelete, setPendingDelete] = useState<Deck | null>(null)

  const [deck, setDeck] = useState<Deck | null>(null)
  const [cardIndex, setCardIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [shuffledIds, setShuffledIds] = useState<string[] | null>(null)
  const [hardOnly, setHardOnly] = useState(false)

  const load = useCallback(async () => {
    try {
      const [docsData, deckData] = await Promise.all([
        api.get<{ documents: DocSummary[] }>('/documents'),
        api.get<{ decks: Deck[] }>('/flashcards'),
      ])
      setDocuments(docsData.documents)
      setDecks(deckData.decks)
      setDocumentId((current) => current || docsData.documents[0]?.id || '')
    } catch (err) {
      setError(errorMessage(err))
      setDocuments([])
      setDecks([])
    }
  }, [])

  useEffect(() => {
    if (!id) void load()
  }, [id, load])

  useEffect(() => {
    if (!id) return
    let active = true
    api
      .get<{ deck: Deck }>(`/flashcards/${id}`)
      .then((data) => {
        if (!active) return
        setDeck(data.deck)
        setCardIndex(0)
        setFlipped(false)
        setShuffledIds(null)
      })
      .catch((err) => active && setError(errorMessage(err)))
    return () => {
      active = false
    }
  }, [id])

  async function generate() {
    if (!documentId) {
      toastError('Choose a document first.')
      return
    }
    setGenerating(true)
    setError('')
    try {
      const data = await api.post<{ title: string; cards: Flashcard[] }>('/ai/generate-flashcards', {
        documentId,
        count,
        chapter: chapter.trim() || undefined,
        language,
      })
      setDraft({ title: data.title, cards: data.cards })
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
      const data = await api.post<{ deck: Deck }>('/flashcards', {
        title: draft.title,
        cards: draft.cards,
        documentId: documentId || undefined,
      })
      setDraft(null)
      success('Flashcard deck saved.')
      navigate(`/app/flashcards/${data.deck.id}`)
    } catch (err) {
      toastError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function mark(card: Flashcard, confidence: 'easy' | 'hard') {
    if (!deck) return
    const nextCards = deck.cards.map((item) => (item.id === card.id ? { ...item, confidence } : item))
    setDeck({ ...deck, cards: nextCards })
    try {
      await api.put(`/flashcards/${deck.id}`, { cards: [{ id: card.id, confidence }] })
    } catch (err) {
      toastError(errorMessage(err))
    }
  }

  async function removeDeck(target: Deck) {
    try {
      await api.del(`/flashcards/${target.id}`)
      setDecks((list) => (list ?? []).filter((item) => item.id !== target.id))
      setPendingDelete(null)
      if (deck?.id === target.id) navigate('/app/flashcards')
      success('Deck deleted.')
    } catch (err) {
      toastError(errorMessage(err))
    }
  }

  const ordered = useMemo(() => {
    if (!deck) return []
    let cards = deck.cards
    if (hardOnly) cards = cards.filter((card) => card.confidence === 'hard')
    if (shuffledIds) {
      const map = new Map(cards.map((card) => [card.id, card]))
      return shuffledIds.map((cardId) => map.get(cardId)).filter((card): card is Flashcard => Boolean(card))
    }
    return cards
  }, [deck, hardOnly, shuffledIds])

  const activeCard = ordered[cardIndex]

  // ---------- Study view ----------
  if (id) {
    if (!deck) {
      return (
        <div className="space-y-4">
          {error ? <Alert tone="error">{error}</Alert> : <Skeleton className="h-72 w-full" />}
        </div>
      )
    }
    const easyCount = deck.cards.filter((card) => card.confidence === 'easy').length
    const hardCount = deck.cards.filter((card) => card.confidence === 'hard').length

    return (
      <div className="space-y-5">
        <Link to="/app/flashcards" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> All flashcard sets
        </Link>

        <PageHeader
          title={deck.title}
          description={`${deck.cards.length} cards · ${easyCount} easy · ${hardCount} difficult · saved ${formatDate(deck.createdAt)}`}
          action={
            <div className="flex flex-wrap gap-2">
              <Button
                variant={hardOnly ? 'primary' : 'secondary'}
                size="md"
                onClick={() => {
                  setHardOnly((v) => !v)
                  setCardIndex(0)
                  setFlipped(false)
                }}
                icon={<Layers className="size-4" />}
              >
                Study difficult ({hardCount})
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  const ids = deck.cards.map((card) => card.id)
                  for (let i = ids.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1))
                    ;[ids[i], ids[j]] = [ids[j], ids[i]]
                  }
                  setShuffledIds(ids)
                  setCardIndex(0)
                  setFlipped(false)
                }}
                icon={<Shuffle className="size-4" />}
              >
                Shuffle
              </Button>
            </div>
          }
        />

        {ordered.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Layers className="size-4" />}
              title={hardOnly ? 'No cards marked difficult' : 'This deck is empty'}
              description={
                hardOnly
                  ? 'Mark cards as difficult while studying and they will appear here for a second pass.'
                  : 'Delete this deck and generate a new one from your document.'
              }
              action={
                hardOnly ? (
                  <Button variant="secondary" onClick={() => setHardOnly(false)}>
                    Study all cards
                  </Button>
                ) : undefined
              }
            />
          </Card>
        ) : activeCard ? (
          <>
            <div className="flex items-center justify-between text-[12px] text-muted">
              <span>
                Card {cardIndex + 1} of {ordered.length}
              </span>
              <div className="flex items-center gap-2">
                {shuffledIds ? (
                  <button
                    onClick={() => {
                      setShuffledIds(null)
                      setCardIndex(0)
                    }}
                    className="inline-flex items-center gap-1 hover:text-ink"
                  >
                    <ArrowUpDown className="size-3" /> Original order
                  </button>
                ) : null}
              </div>
            </div>
            <Progress value={((cardIndex + 1) / ordered.length) * 100} className="h-1" />

            <div className="flip-scene mx-auto max-w-2xl">
              <button
                onClick={() => setFlipped((v) => !v)}
                className="relative block h-[280px] w-full cursor-pointer text-left"
                aria-label={flipped ? 'Show the question side' : 'Show the answer side'}
              >
                <div className="flip-card relative h-full w-full" data-flipped={flipped}>
                  <div className="flip-face absolute inset-0 flex flex-col justify-between rounded-2xl border border-line bg-surface p-6 shadow-raised">
                    <div className="flex items-center justify-between">
                      <Badge tone="primary">{activeCard.topic}</Badge>
                      <span className="text-[10.5px] uppercase tracking-wide text-muted">Question</span>
                    </div>
                    <p className="text-center text-[20px] font-medium leading-snug tracking-[-0.01em] text-ink">{activeCard.front}</p>
                    <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted">
                      <RotateCw className="size-3" /> Click the card to reveal the answer
                    </p>
                  </div>
                  <div className="flip-face flip-back absolute inset-0 flex flex-col justify-between rounded-2xl border border-primary/30 bg-primary-soft p-6 shadow-raised">
                    <div className="flex items-center justify-between">
                      <Badge tone="primary">{activeCard.topic}</Badge>
                      <span className="text-[10.5px] uppercase tracking-wide text-muted">Answer</span>
                    </div>
                    <p className="scroll-thin max-h-[150px] overflow-y-auto text-center text-[15px] leading-relaxed text-ink">
                      {activeCard.back}
                    </p>
                    <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted">
                      <RotateCw className="size-3" /> Click to flip back
                    </p>
                  </div>
                </div>
              </button>
            </div>

            <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-2">
              <Button
                variant="secondary"
                disabled={cardIndex === 0}
                onClick={() => {
                  setCardIndex((i) => Math.max(0, i - 1))
                  setFlipped(false)
                }}
                icon={<ArrowLeft className="size-4" />}
              >
                Previous
              </Button>

              <div className="flex gap-2">
                <Button
                  variant={activeCard.confidence === 'hard' ? 'danger' : 'secondary'}
                  onClick={() => void mark(activeCard, 'hard')}
                  icon={<X className="size-4" />}
                >
                  Difficult
                </Button>
                <Button
                  variant={activeCard.confidence === 'easy' ? 'soft' : 'secondary'}
                  onClick={() => void mark(activeCard, 'easy')}
                  icon={<Check className="size-4" />}
                >
                  Easy
                </Button>
              </div>

              <Button
                disabled={cardIndex >= ordered.length - 1}
                onClick={() => {
                  setCardIndex((i) => Math.min(ordered.length - 1, i + 1))
                  setFlipped(false)
                }}
              >
                Next <ArrowRight className="size-4" />
              </Button>
            </div>
          </>
        ) : null}

        <Card className="p-4">
          <p className="text-[11.5px] font-semibold uppercase tracking-wide text-muted">All cards</p>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {deck.cards.map((card, i) => (
              <button
                key={card.id}
                onClick={() => {
                  const target = ordered.findIndex((item) => item.id === card.id)
                  if (target >= 0) {
                    setCardIndex(target)
                    setFlipped(false)
                  } else {
                    setHardOnly(false)
                    setShuffledIds(null)
                    window.setTimeout(() => {
                      setCardIndex(i)
                      setFlipped(false)
                    }, 0)
                  }
                }}
                className="flex items-start gap-2 rounded-lg border border-line bg-surface-2/50 px-2.5 py-2 text-left text-[11.5px] text-ink-soft transition hover:border-line-strong"
              >
                <span className="mt-0.5 shrink-0 text-[10px] font-medium text-muted">{i + 1}</span>
                <span className="line-clamp-2">{card.front}</span>
                {card.confidence ? (
                  <span className={`ml-auto shrink-0 text-[9.5px] font-medium uppercase ${card.confidence === 'easy' ? 'text-ok' : 'text-bad'}`}>
                    {card.confidence}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </Card>
      </div>
    )
  }

  // ---------- Library + generator ----------
  return (
    <div className="space-y-5">
      <PageHeader title="Flashcards" description="Generate cards from your material, then flip, shuffle and re-study the difficult ones." />
      {error ? <Alert tone="error">{error}</Alert> : null}
      {ai && !ai.configured ? <Alert tone="warn">{ai.message}</Alert> : null}

      {draft ? (
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[14px] font-semibold text-ink">{draft.title}</h2>
              <p className="mt-0.5 text-[12px] text-muted">{draft.cards.length} generated cards — save the deck to study it.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" loading={generating} onClick={() => void generate()}>
                Regenerate
              </Button>
              <Button size="sm" loading={saving} onClick={() => void saveDraft()} icon={<Save className="size-3.5" />}>
                Save deck
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
                Discard
              </Button>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {draft.cards.map((card) => (
              <div key={card.id} className="rounded-xl border border-line bg-surface-2/50 p-3">
                <p className="text-[12.5px] font-medium text-ink">{card.front}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-muted">{card.back}</p>
                <Badge className="mt-2">{card.topic}</Badge>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <Card className="p-5">
          <h2 className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
            <Sparkles className="size-4 text-primary" /> Generate flashcards
          </h2>
          <div className="mt-4 space-y-3.5">
            <div>
              <Label htmlFor="fc-doc">Document</Label>
              <Select id="fc-doc" value={documentId} onChange={(e) => setDocumentId(e.target.value)}>
                {(documents ?? []).map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.filename}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="fc-count">Cards</Label>
                <Select id="fc-count" value={count} onChange={(e) => setCount(Number(e.target.value))}>
                  {[6, 10, 15, 20, 30].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="fc-lang">Language</Label>
                <Select id="fc-lang" value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
                  <option value="english">English</option>
                  <option value="marathi">Marathi</option>
                  <option value="hindi">Hindi</option>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="fc-chapter" hint="optional">
                Chapter or section
              </Label>
              <Input id="fc-chapter" value={chapter} onChange={(e) => setChapter(e.target.value)} placeholder="e.g. Chapter 3 only" maxLength={160} />
            </div>
            <Button
              className="w-full"
              loading={generating}
              disabled={!documents?.length}
              onClick={() => void generate()}
              icon={<Sparkles className="size-4" />}
            >
              Generate cards
            </Button>
            {documents && documents.length === 0 ? (
              <p className="text-[11.5px] text-muted">
                <Link to="/app/documents" className="text-primary hover:underline">
                  Upload a document
                </Link>{' '}
                to generate flashcards.
              </p>
            ) : null}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-[13.5px] font-semibold text-ink">Your flashcard sets</h2>
            <span className="text-[11.5px] text-muted">{decks?.length ?? 0}</span>
          </div>
          {decks === null ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          ) : decks.length === 0 ? (
            <EmptyState
              icon={<Layers className="size-4" />}
              title="No flashcard sets yet"
              description="Generate your first set from a document on the left."
            />
          ) : (
            <ul className="divide-y divide-line">
              {decks.map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <Link to={`/app/flashcards/${item.id}`} className="group min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-ink group-hover:text-primary">{item.title}</p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {item.cards.length} cards · saved {formatDate(item.createdAt)}
                    </p>
                  </Link>
                  <Link to={`/app/flashcards/${item.id}`} className={buttonClasses('secondary', 'sm')}>
                    Study
                  </Link>
                  <button
                    onClick={() => setPendingDelete(item)}
                    className="rounded-md p-1.5 text-muted transition hover:bg-bad-soft hover:text-bad"
                    aria-label={`Delete ${item.title}`}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {!documents && !decks ? (
        <div className="flex items-center gap-2 text-[12px] text-muted">
          <FileText className="size-3.5" /> Loading your material…
        </div>
      ) : null}

      <Modal
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title="Delete this flashcard set?"
        description="The cards and your easy/difficult marks will be removed."
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => pendingDelete && void removeDeck(pendingDelete)}>
              Delete deck
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-ink-soft">{pendingDelete?.title}</p>
      </Modal>
    </div>
  )
}
