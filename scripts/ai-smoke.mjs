// End-to-end verification of every AI flow against the running app.
// Requires GEMINI_API_KEY in .dev.vars. Usage: bun scripts/ai-smoke.mjs
const BASE = process.env.BASE ?? 'http://127.0.0.1:3001'
let failures = 0

function check(label, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

async function call(path, options = {}, token) {
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

function makePdf(lines) {
  const content = ['BT /F1 12 Tf 72 720 Td', ...lines.map((l, i) => `${i ? '0 -22 Td ' : ''}(${l}) Tj`), 'ET'].join(' ')
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

const status = await call('/ai/status')
console.log(`AI status: configured=${status.data.configured} model=${status.data.model}`)
if (!status.data.configured) {
  console.error('\nGEMINI_API_KEY is not set for this server. Add it to .dev.vars and restart, then re-run.')
  process.exit(2)
}

const stamp = Date.now()
const email = `ai_${stamp}@example.com`
const reg = await call('/auth/register', {
  method: 'POST',
  body: JSON.stringify({ name: 'AI Verify', email, password: 'testpass123' }),
})
const token = reg.data.token
check('register', Boolean(token))

const pdf = makePdf([
  'Photosynthesis is the process by which green plants convert light energy into chemical energy.',
  'It takes place in the chloroplast, where the pigment chlorophyll absorbs mainly red and blue light.',
  'The light-dependent reactions produce ATP and NADPH, releasing oxygen from water.',
  'The Calvin cycle then uses ATP and NADPH to fix carbon dioxide into glucose.',
  'Factors affecting the rate include light intensity, carbon dioxide concentration and temperature.',
])
const form = new FormData()
form.append('file', new File([pdf], 'photosynthesis.pdf', { type: 'application/pdf' }))
const upload = await call('/documents/upload', { method: 'POST', body: form }, token)
check('upload + auto analysis', upload.status === 201 && Boolean(upload.data.document?.analysis), `status ${upload.status} ${upload.data.analysisError ?? ''}`)
const analysis = upload.data.document?.analysis
check('analysis has summary', (analysis?.summary?.length ?? 0) > 80, `${analysis?.summary?.length ?? 0} chars`)
check('analysis has topics', (analysis?.topics?.length ?? 0) >= 3, `${analysis?.topics?.length ?? 0} topics`)
check('analysis has definitions', (analysis?.definitions?.length ?? 0) >= 1)
check('analysis has exam questions', (analysis?.examQuestions?.length ?? 0) >= 3)
const documentId = upload.data.document?.id

// Notes: two styles and Marathi
const notes = await call('/ai/generate-notes', {
  method: 'POST',
  body: JSON.stringify({ documentId, style: 'exam', language: 'english' }),
}, token)
check('generate exam notes', notes.status === 200 && notes.data.content?.length > 200, `status ${notes.status}`)
check('notes contain markdown structure', /^#{1,3}\s/m.test(notes.data.content ?? ''))

const marathi = await call('/ai/generate-notes', {
  method: 'POST',
  body: JSON.stringify({ documentId, style: 'short', language: 'marathi' }),
}, token)
check('generate Marathi notes', marathi.status === 200 && /[\u0900-\u097F]/.test(marathi.data.content ?? ''), `status ${marathi.status}`)

// Grounded chat: in-document and off-document
const chatIn = await call('/ai/chat', {
  method: 'POST',
  body: JSON.stringify({ documentId, question: 'Where does photosynthesis take place and which pigment absorbs light?', mode: 'simple' }),
}, token)
check('chat answers from document', chatIn.status === 200 && chatIn.data.answer?.inDocument === true, `status ${chatIn.status}`)
check('chat answer mentions chlorophyll', /chlorophyll/i.test(chatIn.data.answer?.content ?? ''))
check('chat cites a real page', (chatIn.data.answer?.sources ?? []).every((s) => s.page === null || Number.isInteger(s.page)))

const chatOff = await call('/ai/chat', {
  method: 'POST',
  body: JSON.stringify({ chatId: chatIn.data.chat?.id, documentId, question: 'What was the exact 1997 revenue of Infosys?' }),
}, token)
const offText = (chatOff.data.answer?.content ?? '').toLowerCase()
check('off-document question is flagged', chatOff.data.answer?.inDocument === false)
check('off-document answer admits the gap', /(not|doesn.t|no).{0,40}(contain|mention|information|cover)/.test(offText), offText.slice(0, 120))

// Quiz: generation, hidden answers, server-side scoring
const quizGen = await call('/ai/generate-quiz', {
  method: 'POST',
  body: JSON.stringify({ documentId, count: 5, difficulty: 'medium', type: 'mixed' }),
}, token)
check('generate quiz', quizGen.status === 201 && quizGen.data.questions?.length === 5, `status ${quizGen.status} ${quizGen.data.error ?? ''}`)
check('quiz never leaks answers before submit', JSON.stringify(quizGen.data.questions ?? []).includes('correctIndex') === false)
const quizId = quizGen.data.quizId

const quizFetch = await call(`/quizzes/${quizId}`, {}, token)
check('GET quiz hides correctIndex', quizFetch.status === 200 && quizFetch.data.quiz?.questions?.every((q) => q.correctIndex === undefined))
check('quiz has four options per MCQ', quizFetch.data.quiz?.questions?.filter((q) => q.options.length > 2).every((q) => q.options.length === 4))

const answers = (quizFetch.data.quiz?.questions ?? []).map((q) => ({ questionId: q.id, selectedIndex: 0 }))
const submit = await call(`/quizzes/${quizId}/submit`, {
  method: 'POST',
  body: JSON.stringify({ answers, timeTaken: 95 }),
}, token)
const result = submit.data.result
check('submit quiz and score', submit.status === 200 && result?.total === 5, `status ${submit.status} ${submit.data.error ?? ''}`)
check('score matches graded answers', Boolean(result) && result.score === result.graded.filter((g) => g.correct).length)
check('percentage consistent', Boolean(result) && result.percentage === Math.round((result.score / result.total) * 100))
check('explanations returned after submit', Boolean(result) && result.graded.every((g) => (g.explanation ?? '').length > 3))
const quizAfter = await call(`/quizzes/${quizId}`, {}, token)
check('answers revealed after submit', quizAfter.data.quiz?.questions?.every((q) => Number.isInteger(q.correctIndex)))
const reSubmit = await call(`/quizzes/${quizId}/submit`, { method: 'POST', body: JSON.stringify({ answers }) }, token)
check('double submission rejected', reSubmit.status === 409)

// Flashcards
const cards = await call('/ai/generate-flashcards', {
  method: 'POST',
  body: JSON.stringify({ documentId, count: 6 }),
}, token)
check('generate flashcards', cards.status === 200 && cards.data.cards?.length >= 4, `status ${cards.status}`)
check('flashcards have front and back', cards.data.cards?.every((c) => c.front?.length > 3 && c.back?.length > 3))
const savedDeck = await call('/flashcards', {
  method: 'POST',
  body: JSON.stringify({ title: cards.data.title, cards: cards.data.cards, documentId }),
}, token)
check('save flashcard deck', savedDeck.status === 201)

// Global assistant
const explain = await call('/ai/explain', {
  method: 'POST',
  body: JSON.stringify({ prompt: 'Explain the Calvin cycle in two simple sentences.', context: 'general', mode: 'beginner' }),
}, token)
check('global assistant answers', explain.status === 200 && (explain.data.answer?.length ?? 0) > 40, `status ${explain.status}`)
const explainDoc = await call('/ai/explain', {
  method: 'POST',
  body: JSON.stringify({ prompt: 'What limits the rate of photosynthesis?', context: 'document', documentId }),
}, token)
check('document-context assistant answers', explainDoc.status === 200 && (explainDoc.data.answer?.length ?? 0) > 20)

// Viva
const viva = await call('/viva/start', {
  method: 'POST',
  body: JSON.stringify({ subject: 'Biology', topic: 'Photosynthesis', difficulty: 'medium', count: 3, documentId }),
}, token)
check('viva questions generated', viva.status === 201 && viva.data.session?.questions?.length === 3, `status ${viva.status} ${viva.data.error ?? ''}`)
const vivaId = viva.data.session?.id
const q1 = viva.data.session?.questions?.[0]
const answer = await call(`/viva/${vivaId}/answer`, {
  method: 'POST',
  body: JSON.stringify({ questionId: q1.id, answer: 'Photosynthesis happens in the chloroplast. Chlorophyll absorbs light energy, water is split to release oxygen, and glucose is produced from carbon dioxide.' }),
}, token)
const evaluation = answer.data.evaluation
check('viva evaluates an answer', answer.status === 200 && typeof evaluation?.score === 'number', `status ${answer.status} ${answer.data.error ?? ''}`)
check('viva score in range', evaluation?.score >= 0 && evaluation?.score <= 10, `score ${evaluation?.score}`)
check('viva feedback is specific', (evaluation?.feedback?.length ?? 0) > 20 && Array.isArray(evaluation?.correct))
const finish = await call(`/viva/${vivaId}/finish`, { method: 'POST', body: JSON.stringify({}) }, token)
check('viva report generated', finish.status === 200 && typeof finish.data.summary?.averageScore === 'number', `status ${finish.status}`)

// Planner
const examDate = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10)
const plan = await call('/ai/generate-plan', {
  method: 'POST',
  body: JSON.stringify({ subjects: ['Biology'], topics: ['Photosynthesis', 'Respiration'], examDate, dailyMinutes: 60, language: 'english' }),
}, token)
check('AI study plan created', plan.status === 201 && plan.data.created >= 1, `status ${plan.status} ${plan.data.error ?? ''}`)
const planTasks = await call('/tasks', {}, token)
check('plan tasks persisted with valid dates', planTasks.data.tasks?.every((t) => !t.dueDate || t.dueDate <= examDate))

// Cleanup
await call(`/documents/${documentId}`, { method: 'DELETE' }, token)

console.log(failures === 0 ? '\nALL AI FLOW CHECKS PASSED' : `\n${failures} AI CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
