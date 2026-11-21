export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    document.execCommand('copy')
    document.body.removeChild(area)
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Minimal Markdown → HTML for the print stylesheet. */
function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  let listOpen: 'ul' | 'ol' | null = null
  let paragraph: string[] = []

  const inline = (text: string) =>
    escapeHtml(text)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')

  const closeList = () => {
    if (listOpen) {
      out.push(`</${listOpen}>`)
      listOpen = null
    }
  }
  const flushParagraph = () => {
    if (paragraph.length) {
      out.push(`<p>${inline(paragraph.join(' '))}</p>`)
      paragraph = []
    }
  }

  for (const line of lines) {
    const heading = /^(#{1,4})\s+(.*)$/.exec(line)
    if (heading) {
      closeList()
      flushParagraph()
      const level = Math.min(heading[1].length + 1, 5)
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`)
      continue
    }
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line)
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    if (bullet || numbered) {
      flushParagraph()
      const type = bullet ? 'ul' : 'ol'
      if (listOpen !== type) {
        closeList()
        out.push(`<${type}>`)
        listOpen = type
      }
      out.push(`<li>${inline((bullet ?? numbered)![1])}</li>`)
      continue
    }
    if (!line.trim()) {
      closeList()
      flushParagraph()
      continue
    }
    closeList()
    paragraph.push(line)
  }
  closeList()
  flushParagraph()
  return out.join('\n')
}

/** Opens a print-ready window; the browser's "Save as PDF" produces the file. */
export function printDocument(title: string, markdown: string, subtitle?: string) {
  const win = window.open('', '_blank', 'width=820,height=900')
  if (!win) return false
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  @page { margin: 22mm 18mm; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, 'Noto Sans Devanagari', sans-serif; color: #16161c; line-height: 1.6; font-size: 13.5px; max-width: 720px; margin: 0 auto; padding: 24px; }
  header { border-bottom: 1px solid #e4e4ea; padding-bottom: 14px; margin-bottom: 22px; }
  .brand { font-size: 10px; letter-spacing: .16em; text-transform: uppercase; color: #6d6d7b; }
  h1 { font-size: 22px; margin: 6px 0 0; letter-spacing: -.02em; }
  .sub { color: #6d6d7b; font-size: 11.5px; margin-top: 4px; }
  h2 { font-size: 15px; margin: 22px 0 6px; } h3 { font-size: 13.5px; margin: 18px 0 6px; }
  p { margin: 8px 0; } ul, ol { margin: 8px 0; padding-left: 20px; } li { margin: 3px 0; }
  code { background: #f4f4f7; padding: 1px 4px; border-radius: 4px; font-size: 11.5px; }
  strong { color: #16161c; }
  footer { margin-top: 28px; border-top: 1px solid #e4e4ea; padding-top: 10px; color: #6d6d7b; font-size: 10.5px; }
</style></head><body>
<header><div class="brand">AI Study Buddy</div><h1>${escapeHtml(title)}</h1>${subtitle ? `<div class="sub">${escapeHtml(subtitle)}</div>` : ''}</header>
${markdownToHtml(markdown)}
<footer>Generated with AI Study Buddy · ${new Date().toLocaleDateString()}</footer>
<script>window.onload = function () { window.focus(); window.print(); }</script>
</body></html>`)
  win.document.close()
  return true
}
