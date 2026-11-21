// Captures the deployed site into docs/live-site.png. Run by
// .github/workflows/live-screenshot.yml, which commits the result.
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'

const url = process.env.SITE_URL || 'https://ai-study-buddy-live.vercel.app/'
const out = 'docs/live-site.png'

await mkdir('docs', { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 })
const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 })

if (!response || !response.ok()) {
  throw new Error(`Live site responded ${response ? response.status() : 'no response'}`)
}

// The landing page animates in; give it a moment to settle.
await page.waitForTimeout(2500)
await page.screenshot({ path: out })
await browser.close()

console.log(`saved ${out}`)
