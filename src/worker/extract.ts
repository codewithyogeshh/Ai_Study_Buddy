import { unzipSync } from 'fflate'
import { extractText, getDocumentProxy } from 'unpdf'

export type ExtractionResult = {
  text: string
  pageCount: number
  /** True when the PDF has essentially no text layer (likely a scan). */
  looksScanned: boolean
  warning?: string
}

export const MAX_FILE_BYTES = 15 * 1024 * 1024
export const MAX_TEXT_CHARS = 220_000

const ALLOWED = [
  { ext: 'pdf', mimes: ['application/pdf'] },
  { ext: 'txt', mimes: ['text/plain', 'text/markdown', 'application/octet-stream', ''] },
  {
    ext: 'docx',
    mimes: [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/zip',
      'application/octet-stream',
      '',
    ],
  },
]

export function fileKind(filename: string, mime: string): 'pdf' | 'txt' | 'docx' | null {
  const ext = filename.toLowerCase().split('.').pop() ?? ''
  const entry = ALLOWED.find((a) => a.ext === ext)
  if (!entry) return null
  // Browsers attach parameters (e.g. "text/plain;charset=utf-8") and some
  // clients send a generic type; trust the extension in those cases only.
  const m = (mime || '').toLowerCase().split(';')[0].trim()
  const generic = !m || m === 'application/octet-stream'
  if (!generic && !entry.mimes.includes(m)) return null
  return ext as 'pdf' | 'txt' | 'docx'
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&')
}

function cleanText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

async function extractPdf(buffer: ArrayBuffer): Promise<ExtractionResult> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  const { totalPages, text } = await extractText(pdf, { mergePages: false })
  const pages = Array.isArray(text) ? text : [text]
  const withMarkers = pages
    .map((p, i) => `[Page ${i + 1}]\n${cleanText(p)}`)
    .join('\n\n')
    .trim()
  const chars = withMarkers.replace(/\[Page \d+\]/g, '').replace(/\s/g, '').length
  const looksScanned = totalPages > 0 && chars < totalPages * 40
  return {
    text: cleanText(withMarkers),
    pageCount: totalPages,
    looksScanned,
    warning: looksScanned
      ? 'This PDF appears to be a scan with no embedded text layer. OCR is not available on this deployment, so there is little or no readable text. Upload a text-based PDF or paste the content as a .txt file.'
      : undefined,
  }
}

function extractDocx(buffer: ArrayBuffer): ExtractionResult {
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(new Uint8Array(buffer))
  } catch {
    throw new Error('That file is not a valid .docx archive.')
  }
  const doc = files['word/document.xml']
  if (!doc) throw new Error('That .docx file has no readable document body.')
  const xml = new TextDecoder('utf-8').decode(doc)
  const body = xml
    // Paragraph and break boundaries become newlines before tags are stripped.
    .replace(/<w:br\s*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<w:tab\s*\/>/g, '\t')
    .replace(/<[^>]+>/g, '')
  const text = cleanText(decodeEntities(body))
  return { text, pageCount: Math.max(1, Math.ceil(text.length / 2500)), looksScanned: false }
}

export async function extractDocument(
  buffer: ArrayBuffer,
  _filename: string,
  kind: 'pdf' | 'txt' | 'docx',
): Promise<ExtractionResult> {
  if (buffer.byteLength > MAX_FILE_BYTES) {
    throw new Error('File is larger than the 15 MB limit.')
  }
  if (kind === 'pdf') {
    try {
      return await extractPdf(buffer)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (/password/i.test(message)) throw new Error('This PDF is password protected. Remove the password and try again.')
      throw new Error('The PDF could not be read. It may be corrupted or unsupported.')
    }
  }
  if (kind === 'txt') {
    const text = cleanText(new TextDecoder('utf-8').decode(buffer))
    return { text, pageCount: Math.max(1, Math.ceil(text.length / 2500)), looksScanned: false }
  }
  return extractDocx(buffer)
}

/** Keep stored text inside D1's comfortable per-row size while retaining both ends. */
export function capText(text: string): string {
  if (text.length <= MAX_TEXT_CHARS) return text
  const head = text.slice(0, Math.floor(MAX_TEXT_CHARS * 0.7))
  const tail = text.slice(-Math.floor(MAX_TEXT_CHARS * 0.25))
  return `${head}\n\n[... middle of document truncated ...]\n\n${tail}`
}

/**
 * Pick the passages that matter for a question. Chunks keep their [Page N]
 * marker so the model can cite a page only when one really exists.
 */
export function selectRelevantChunks(text: string, query: string, maxChars = 40_000): string {
  if (!text) return ''
  if (text.length <= maxChars) return text
  const chunks = text.split(/\n{2,}/).reduce<string[]>((acc, piece) => {
    const last = acc[acc.length - 1]
    if (last && last.length < 1400) acc[acc.length - 1] = `${last}\n\n${piece}`
    else acc.push(piece)
    return acc
  }, [])
  const terms = query
    .toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097f\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2)
  const scored = chunks.map((chunk, index) => {
    const lower = chunk.toLowerCase()
    let score = 0
    for (const term of new Set(terms)) {
      const hits = lower.split(term).length - 1
      if (hits > 0) score += Math.min(hits, 4) * term.length
    }
    // Small recency-free tie-break so early chapters win on equal scores.
    return { chunk, index, score: score + (chunks.length - index) / (chunks.length * 100) }
  })
  const picked = new Set<number>()
  let budget = maxChars
  for (const item of [...scored].sort((a, b) => b.score - a.score)) {
    if (budget <= 0) break
    const piece = item.chunk.slice(0, budget)
    picked.add(item.index)
    budget -= piece.length
    if (picked.size >= 18) break
  }
  return [...picked]
    .sort((a, b) => a - b)
    .map((i) => chunks[i])
    .join('\n\n')
    .slice(0, maxChars)
}
