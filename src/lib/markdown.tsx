import { Fragment, type ReactNode } from 'react'

/**
 * A deliberately small Markdown renderer for AI output and notes. It renders
 * React elements (never HTML), so untrusted model/document text cannot inject
 * markup or scripts.
 */
function inline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  // Split on **bold**, *italic*, `code` while keeping delimiters.
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*)/g
  const parts = text.split(pattern)
  parts.forEach((part, i) => {
    const key = `${keyPrefix}-${i}`
    if (!part) return
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      nodes.push(<strong key={key}>{part.slice(2, -2)}</strong>)
    } else if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      nodes.push(<code key={key}>{part.slice(1, -1)}</code>)
    } else if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      nodes.push(<em key={key}>{part.slice(1, -1)}</em>)
    } else {
      nodes.push(<Fragment key={key}>{part}</Fragment>)
    }
  })
  return nodes
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let i = 0
  let list: { ordered: boolean; items: string[] } | null = null

  const flushList = () => {
    if (!list) return
    const items = list.items.map((item, idx) => <li key={`li-${blocks.length}-${idx}`}>{inline(item, `li-${blocks.length}-${idx}`)}</li>)
    blocks.push(list.ordered ? <ol key={`ol-${blocks.length}`}>{items}</ol> : <ul key={`ul-${blocks.length}`}>{items}</ul>)
    list = null
  }

  while (i < lines.length) {
    const line = lines[i]

    // Fenced code block
    if (line.trim().startsWith('```')) {
      flushList()
      const code: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        code.push(lines[i])
        i++
      }
      i++
      blocks.push(
        <pre key={`pre-${blocks.length}`}>
          <code>{code.join('\n')}</code>
        </pre>,
      )
      continue
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line)
    if (heading) {
      flushList()
      const level = heading[1].length
      const content = inline(heading[2], `h-${blocks.length}`)
      const Tag = level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3'
      blocks.push(<Tag key={`h-${blocks.length}`}>{content}</Tag>)
      i++
      continue
    }

    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line)
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    if (bullet || numbered) {
      const ordered = Boolean(numbered)
      const content = (bullet ?? numbered)![1]
      if (list && list.ordered !== ordered) flushList()
      if (!list) list = { ordered, items: [] }
      list.items.push(content)
      i++
      continue
    }

    if (/^\s*[—–-]{3,}\s*$/.test(line)) {
      flushList()
      blocks.push(<hr key={`hr-${blocks.length}`} />)
      i++
      continue
    }

    if (line.trim().startsWith('>')) {
      flushList()
      const quote: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quote.push(lines[i].trim().replace(/^>\s?/, ''))
        i++
      }
      blocks.push(<blockquote key={`bq-${blocks.length}`}>{inline(quote.join(' '), `bq-${blocks.length}`)}</blockquote>)
      continue
    }

    if (!line.trim()) {
      flushList()
      i++
      continue
    }

    flushList()
    const paragraph: string[] = [line]
    i++
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|\s*[-*•]\s|\s*\d+[.)]\s|>)/.test(lines[i])) {
      paragraph.push(lines[i])
      i++
    }
    blocks.push(<p key={`p-${blocks.length}`}>{inline(paragraph.join(' '), `p-${blocks.length}`)}</p>)
  }
  flushList()

  return <div className={`prose-note ${className ?? ''}`}>{blocks}</div>
}
