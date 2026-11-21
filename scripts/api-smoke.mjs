// End-to-end smoke test against a running dev server.
const BASE = process.env.BASE ?? 'http://127.0.0.1:5364'
let failures = 0

function check(label, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

async function json(path, options = {}, token) {
  const headers = { ...(options.body instanceof FormData ? {} : { 'content-type': 'application/json' }), ...options.headers }
  if (token) headers.authorization = `Bearer ${token}`
  const res = await fetch(`${BASE}/api${path}`, { ...options, headers })
  const text = await res.text()
  let data = {}
  try {
    data = JSON.parse(text)
  } catch {
    data = { raw: text }
  }
  return { status: res.status, data }
}

/** Builds a valid one-page PDF with a proper xref table. */
function makePdf(line1, line2) {
  const content = `BT /F1 12 Tf 72 720 Td (${line1}) Tj 0 -18 Td (${line2}) Tj ET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = []
  objects.forEach((body, i) => {
    offsets.push(pdf.length)
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`
  })
  const xrefStart = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`
  return new Uint8Array([...pdf].map((c) => c.charCodeAt(0)))
}

const stamp = Date.now()
const email = `smoke_${stamp}@example.com`

const health = await json('/health')
check('GET /api/health', health.status === 200 && health.data.ok === true)

const register = await json('/auth/register', {
  method: 'POST',
  body: JSON.stringify({ name: 'Smoke Student', email, password: 'testpass123' }),
})
check('POST /api/auth/register', register.status === 201 && Boolean(register.data.token), `status ${register.status}`)
const token = register.data.token

const dup = await json('/auth/register', {
  method: 'POST',
  body: JSON.stringify({ name: 'Smoke Student', email, password: 'testpass123' }),
})
check('duplicate email rejected', dup.status === 409)

const weak = await json('/auth/register', {
  method: 'POST',
  body: JSON.stringify({ name: 'X', email: `weak_${stamp}@example.com`, password: 'short' }),
})
check('weak password rejected', weak.status === 400)

const badLogin = await json('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password: 'wrongpassword1' }),
})
check('wrong password rejected', badLogin.status === 401)

const login = await json('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password: 'testpass123' }),
})
check('POST /api/auth/login', login.status === 200 && Boolean(login.data.token))

const me = await json('/auth/me', {}, token)
check('GET /api/auth/me', me.status === 200 && me.data.user?.email === email)

const noAuth = await json('/documents')
check('unauthenticated request blocked', noAuth.status === 401)

// TXT upload
const txtForm = new FormData()
txtForm.append('file', new File(['Operating systems manage hardware and software resources.\nDeadlock occurs when processes wait on each other.\n'], 'os-notes.txt', { type: 'text/plain' }))
const txtUpload = await json('/documents/upload', { method: 'POST', body: txtForm }, token)
check('upload TXT', txtUpload.status === 201 && txtUpload.data.document?.wordCount > 5, `status ${txtUpload.status}`)
const txtId = txtUpload.data.document?.id

// Whether the deployment has a Gemini key decides what the AI checks assert.
const aiStatus = await json('/ai/status', {})
const aiOn = Boolean(aiStatus.data.configured)

// PDF upload + real extraction
const pdfForm = new FormData()
pdfForm.append('file', new File([makePdf('Photosynthesis converts light energy into chemical energy.', 'Chlorophyll absorbs light inside the chloroplast.')], 'biology.pdf', { type: 'application/pdf' }))
const pdfUpload = await json('/documents/upload', { method: 'POST', body: pdfForm }, token)
check('upload PDF', pdfUpload.status === 201, `status ${pdfUpload.status} ${pdfUpload.data.error ?? ''}`)
check('PDF text extracted', (pdfUpload.data.document?.wordCount ?? 0) > 5, `words ${pdfUpload.data.document?.wordCount}`)
check(
  aiOn ? 'upload auto-analysis ran with the key configured' : 'AI analysis reported unavailable without key',
  aiOn ? !pdfUpload.data.analysisError : Boolean(pdfUpload.data.analysisError),
  String(pdfUpload.data.analysisError ?? ''),
)
const pdfId = pdfUpload.data.document?.id

const rejectedForm = new FormData()
rejectedForm.append('file', new File(['console.log(1)'], 'evil.js', { type: 'text/javascript' }))
const rejected = await json('/documents/upload', { method: 'POST', body: rejectedForm }, token)
check('unsupported file type rejected', rejected.status === 415)

const list = await json('/documents', {}, token)
check('GET /api/documents', list.status === 200 && list.data.documents?.length === 2)

const detail = await json(`/documents/${pdfId}`, {}, token)
check('GET /api/documents/:id', detail.status === 200 && detail.data.document?.textPreview?.includes('Photosynthesis'))

// Isolation: another account must not see this document
const other = await json('/auth/register', {
  method: 'POST',
  body: JSON.stringify({ name: 'Other Student', email: `other_${stamp}@example.com`, password: 'testpass123' }),
})
const otherToken = other.data.token
const cross = await json(`/documents/${pdfId}`, {}, otherToken)
check('cross-user document access blocked', cross.status === 404)

// Tasks
const taskCreate = await json('/tasks', {
  method: 'POST',
  body: JSON.stringify({ subject: 'Biology', topic: 'Photosynthesis', title: 'Revise light reactions', dueDate: new Date().toISOString().slice(0, 10) }),
}, token)
check('POST /api/tasks', taskCreate.status === 201)
const taskId = taskCreate.data.task?.id
const taskDone = await json(`/tasks/${taskId}`, { method: 'PUT', body: JSON.stringify({ completed: true }) }, token)
check('PUT /api/tasks/:id completes task', taskDone.status === 200 && taskDone.data.task?.completed === true)

// Notes CRUD
const noteCreate = await json('/notes', {
  method: 'POST',
  body: JSON.stringify({ title: 'Smoke note', content: '## Heading\n- point', documentId: txtId, language: 'english', style: 'short' }),
}, token)
check('POST /api/notes', noteCreate.status === 201)
const noteId = noteCreate.data.note?.id
const noteUpdate = await json(`/notes/${noteId}`, { method: 'PUT', body: JSON.stringify({ title: 'Smoke note edited' }) }, token)
check('PUT /api/notes/:id', noteUpdate.status === 200 && noteUpdate.data.note?.title === 'Smoke note edited')

// Flashcards persist
const deckCreate = await json('/flashcards', {
  method: 'POST',
  body: JSON.stringify({ title: 'Smoke deck', documentId: pdfId, cards: [{ front: 'What is chlorophyll?', back: 'The pigment that absorbs light.' }] }),
}, token)
check('POST /api/flashcards', deckCreate.status === 201)

// Analytics reflect real data
const dash = await json('/analytics/dashboard', {}, token)
check(
  'GET /api/analytics/dashboard',
  dash.status === 200 && dash.data.stats?.documents === 2 && dash.data.stats?.tasksCompleted === 1,
  JSON.stringify(dash.data.stats ?? dash.data),
)
const progress = await json('/analytics/progress', {}, token)
check('GET /api/analytics/progress', progress.status === 200 && Array.isArray(progress.data.activity))

// AI checks follow the deployment: a missing key must fail clearly, never fake
// an answer; a configured key must produce a real response.
const aiChat = await json('/ai/chat', { method: 'POST', body: JSON.stringify({ documentId: pdfId, question: 'What does chlorophyll do?' }) }, token)
if (aiOn) {
  check('AI chat answers when configured', aiChat.status === 200 && (aiChat.data.answer?.content ?? '').length > 20, `status ${aiChat.status}`)
} else {
  check('AI endpoint returns clear config error without key', aiChat.status === 503 && /GEMINI_API_KEY/.test(aiChat.data.error ?? ''), `status ${aiChat.status}`)
}

const quizGen = await json('/ai/generate-quiz', { method: 'POST', body: JSON.stringify({ documentId: pdfId, count: 5 }) }, token)
check(aiOn ? 'quiz generation works when configured' : 'quiz generation errors cleanly without key', quizGen.status === (aiOn ? 201 : 503), `status ${quizGen.status} ${quizGen.data.error ?? ''}`)

// Deleting a document cascades its notes
const del = await json(`/documents/${txtId}`, { method: 'DELETE' }, token)
check('DELETE /api/documents/:id', del.status === 200)
const notesAfter = await json('/notes', {}, token)
check('document delete cascades notes', notesAfter.data.notes?.length === 0)

console.log(failures === 0 ? '\nALL SMOKE CHECKS PASSED' : `\n${failures} SMOKE CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
