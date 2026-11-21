import { generateJson, generateText, languageInstruction } from './gemini'
import type { Bindings } from './types'
import { selectRelevantChunks } from './extract'

/* ------------------------------------------------------------------ helpers */
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v.trim() : fallback)
const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

function strings(v: unknown, max = 40): string[] {
  return arr(v)
    .map((x) => str(x))
    .filter(Boolean)
    .slice(0, max)
}

function documentBlock(text: string, query: string): string {
  const excerpts = selectRelevantChunks(text, query)
  return `<document>\n${excerpts}\n</document>`
}

/* ---------------------------------------------------------------- analysis */
export type Analysis = {
  summary: string
  topics: string[]
  concepts: string[]
  definitions: { term: string; meaning: string }[]
  keyPoints: string[]
  examQuestions: string[]
  chapters: { title: string; summary: string }[]
}

export async function analyzeDocument(env: Bindings, text: string): Promise<Analysis> {
  const raw = await generateJson<Record<string, unknown>>(env, {
    json: true,
    temperature: 0.2,
    maxOutputTokens: 4096,
    system:
      'Analyse study material and return a JSON object with exactly these keys: summary (string, 120-180 words), topics (string[] of 5-10 main topics), concepts (string[] of 5-12 important concepts), definitions (array of {term, meaning} for key terms actually defined in the material), keyPoints (string[] of 6-12 important points), examQuestions (string[] of 6-10 likely examination questions answerable from the material), chapters (array of {title, summary} - only when the material has clear chapter or unit structure, otherwise an empty array).',
    prompt: `${documentBlock(text, 'summary topics concepts definitions examination')}\n\nAnalyse the study material above and return the JSON object.`,
  })
  return {
    summary: str(raw.summary),
    topics: strings(raw.topics, 12),
    concepts: strings(raw.concepts, 15),
    definitions: arr(raw.definitions)
      .map((d) => {
        const o = (d ?? {}) as Record<string, unknown>
        return { term: str(o.term), meaning: str(o.meaning) }
      })
      .filter((d) => d.term && d.meaning)
      .slice(0, 20),
    keyPoints: strings(raw.keyPoints, 15),
    examQuestions: strings(raw.examQuestions, 12),
    chapters: arr(raw.chapters)
      .map((c) => {
        const o = (c ?? {}) as Record<string, unknown>
        return { title: str(o.title), summary: str(o.summary) }
      })
      .filter((c) => c.title)
      .slice(0, 20),
  }
}

/* ------------------------------------------------------------------- notes */
export const NOTE_STYLES = [
  'short',
  'detailed',
  'exam',
  'chapter',
  'bullet',
  'revision',
  'definitions',
  'proscons',
  'examples',
  'takeaways',
] as const

const STYLE_BRIEF: Record<string, string> = {
  short: 'Concise short notes: only essentials, under 500 words.',
  detailed: 'Detailed notes covering every important idea with explanations and structure.',
  exam: 'Exam-oriented notes: model answer structure, likely questions, marking points and keywords examiners look for.',
  chapter: 'Chapter-wise notes: one heading per chapter/unit with its own summary and bullet points.',
  bullet: 'Bullet-point notes only. No long paragraphs.',
  revision: 'Last-minute revision notes: crisp facts, formulae, lists and mnemonics.',
  definitions: 'Definition-focused notes: every important term with a precise one or two line definition.',
  proscons: 'Include advantages and disadvantages for the main concepts, in two clear sections each.',
  examples: 'Example-led notes: a concrete worked example for each main concept.',
  takeaways: 'Key-takeaways format: 8-15 numbered takeaways a student can revise in five minutes.',
}

export async function generateNotes(
  env: Bindings,
  text: string,
  opts: { style: string; language: string; focus?: string },
): Promise<{ title: string; content: string }> {
  const style = NOTE_STYLES.includes(opts.style as (typeof NOTE_STYLES)[number]) ? opts.style : 'detailed'
  const focus = opts.focus?.trim()
  const raw = await generateJson<Record<string, unknown>>(env, {
    json: true,
    temperature: 0.3,
    maxOutputTokens: 4096,
    system: `Create study notes from the material as JSON: {"title": string, "content": string}. The content must be Markdown using "## " section headings and "- " bullets. ${STYLE_BRIEF[style]} ${languageInstruction(opts.language)} Include important definitions and examples where they genuinely appear or are needed to understand the material.`,
    prompt: `${documentBlock(text, focus || 'notes definitions examples concepts')}\n\n${focus ? `Focus the notes on: ${focus}\n\n` : ''}Write the study notes now.`,
  })
  return {
    title: str(raw.title, 'Study notes'),
    content: str(raw.content),
  }
}

/* -------------------------------------------------------------------- quiz */
export type QuizQuestion = {
  id: string
  type: 'mcq' | 'tf'
  question: string
  options: string[]
  answerIndex: number
  explanation: string
  topic: string
  difficulty: string
}

export async function generateQuiz(
  env: Bindings,
  text: string,
  opts: { count: number; difficulty: string; type: 'mcq' | 'tf' | 'mixed'; language: string; focus?: string },
): Promise<{ title: string; questions: QuizQuestion[] }> {
  const count = Math.min(Math.max(opts.count, 3), 20)
  const typeRule =
    opts.type === 'tf'
      ? 'Every question must be type "tf" with options exactly ["True", "False"].'
      : opts.type === 'mixed'
        ? 'Mix types: at least half "mcq", the rest "tf".'
        : 'Every question must be type "mcq" with exactly four plausible options.'
  const raw = await generateJson<Record<string, unknown>>(env, {
    json: true,
    temperature: 0.4,
    maxOutputTokens: 4096,
    system: `Create a multiple-choice quiz from study material. Return JSON: {"title": string, "questions": [{"type": "mcq"|"tf", "question": string, "options": string[], "answerIndex": number, "explanation": string, "topic": string, "difficulty": string}]}.
Produce exactly ${count} questions. ${typeRule}
Rules: "answerIndex" is the 0-based index of the correct option. Exactly one option is correct. MCQ questions have 4 options. Explanations are 1-2 sentences on why the answer is right. "topic" is a short topic label drawn from the material. Difficulty is one of easy, medium, hard and must match the requested difficulty (${opts.difficulty}). Questions must be answerable from the material alone, must not reference page numbers, and must not repeat. ${languageInstruction(opts.language)}`,
    prompt: `${documentBlock(text, `${opts.focus ?? ''} ${opts.difficulty} quiz questions`)}\n\nWrite the ${count} ${opts.difficulty} questions now.`,
  })

  const questions: QuizQuestion[] = []
  arr(raw.questions).forEach((q, i) => {
    const o = (q ?? {}) as Record<string, unknown>
    const question = str(o.question)
    if (!question) return
    let type: 'mcq' | 'tf' = o.type === 'tf' ? 'tf' : 'mcq'
    let options = strings(o.options, 6)
    if (type === 'tf') {
      options = ['True', 'False']
    } else {
      options = options.slice(0, 4)
      if (options.length < 2) return
      if (options.length < 4) {
        // Pad so every MCQ always offers four options; padding is never correct.
        while (options.length < 4) options.push(`None of the above (option ${options.length + 1})`)
      }
    }
    let answerIndex = num(o.answerIndex, -1)
    if (type === 'tf' && answerIndex < 0) {
      const answer = str(o.answer).toLowerCase()
      answerIndex = answer.includes('false') ? 1 : 0
    }
    if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= options.length) answerIndex = 0
    questions.push({
      id: `q_${i}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      question,
      options,
      answerIndex,
      explanation: str(o.explanation, 'See the referenced topic in your material.'),
      topic: str(o.topic, 'General'),
      difficulty: str(o.difficulty, opts.difficulty),
    })
  })

  if (questions.length === 0) throw new Error('The AI did not produce usable questions. Try again or pick a smaller scope.')
  return { title: str(raw.title, 'Practice quiz'), questions: questions.slice(0, count) }
}

/* -------------------------------------------------------------- flashcards */
export type Flashcard = { id: string; front: string; back: string; topic: string }

export async function generateFlashcards(
  env: Bindings,
  text: string,
  opts: { count: number; chapter?: string; language: string },
): Promise<{ title: string; cards: Flashcard[] }> {
  const count = Math.min(Math.max(opts.count, 4), 30)
  const chapter = opts.chapter?.trim()
  const raw = await generateJson<Record<string, unknown>>(env, {
    json: true,
    temperature: 0.4,
    maxOutputTokens: 4096,
    system: `Create ${count} study flashcards from the material. Return JSON: {"title": string, "cards": [{"front": string, "back": string, "topic": string}]}.
"front" is a short question or term (max 20 words). "back" is a clear, self-contained answer (max 60 words). Base every card on the material. ${languageInstruction(opts.language)}`,
    prompt: `${documentBlock(text, chapter || 'key terms definitions concepts')}\n\n${chapter ? `Only use the parts about: ${chapter}\n\n` : ''}Write the ${count} flashcards now.`,
  })
  const cards = arr(raw.cards)
    .map((c, i) => {
      const o = (c ?? {}) as Record<string, unknown>
      return {
        id: `c_${i}_${Math.random().toString(36).slice(2, 8)}`,
        front: str(o.front),
        back: str(o.back),
        topic: str(o.topic, 'General'),
      }
    })
    .filter((c) => c.front && c.back)
    .slice(0, count)
  if (!cards.length) throw new Error('The AI did not produce usable flashcards. Try again.')
  return { title: str(raw.title, chapter ? `Flashcards — ${chapter}` : 'Flashcards'), cards }
}

/* -------------------------------------------------------------------- chat */
export const CHAT_MODES = [
  'simple',
  'detailed',
  'beginner',
  'exam',
  'marathi',
  'english',
  'example',
] as const

const MODE_BRIEF: Record<string, string> = {
  simple: 'Answer simply and directly, in a few short paragraphs.',
  detailed: 'Give a thorough, structured explanation with headings and detail.',
  beginner: 'Explain like the student is a complete beginner. Use an everyday analogy first.',
  exam: 'Answer in exam-answer format: definition, points, diagram description if useful, conclusion. Suitable for writing in an exam.',
  marathi: 'Reply in simple Marathi (Devanagari) while keeping technical terms in English brackets.',
  english: 'Reply in English.',
  example: 'Lead with a concrete worked example, then explain the principle behind it.',
}

export type ChatTurn = { role: 'user' | 'assistant'; content: string }

export async function chatWithDocument(
  env: Bindings,
  args: { text: string; question: string; history: ChatTurn[]; mode: string; language: string; documentName: string },
): Promise<{ answer: string; inDocument: boolean; sources: { page: number | null; note: string }[] }> {
  const mode = CHAT_MODES.includes(args.mode as (typeof CHAT_MODES)[number]) ? args.mode : 'simple'
  const language = mode === 'marathi' ? 'marathi' : args.language
  const history = args.history.slice(-6)
  const historyText = history.map((h) => `${h.role === 'user' ? 'Student' : 'Assistant'}: ${h.content.slice(0, 1200)}`).join('\n')
  const raw = await generateJson<Record<string, unknown>>(env, {
    json: true,
    temperature: 0.3,
    maxOutputTokens: 3072,
    system: `You answer questions about one uploaded document. Return JSON: {"answer": string, "inDocument": boolean, "sources": [{"page": number|null, "note": string}]}.
"inDocument" is true only if the excerpts actually contain the answer. If they do not, set it false and say clearly that the document does not contain sufficient information, then give any general knowledge in a separate part headed "General knowledge (not from your document)". Never pretend general knowledge came from the document. "sources" lists the [Page N] markers you actually used; use null for page and a short description of the section when there is no page marker. Do not invent page numbers. ${MODE_BRIEF[mode]} ${languageInstruction(language)}`,
    prompt: `Document name: ${args.documentName}\n\n${documentBlock(args.text, args.question)}\n\n${historyText ? `Recent conversation:\n${historyText}\n\n` : ''}Student question: ${args.question}`,
  })
  const sources = arr(raw.sources)
    .slice(0, 5)
    .map((s) => {
      const o = (s ?? {}) as Record<string, unknown>
      const page = typeof o.page === 'number' && o.page > 0 ? Math.floor(o.page) : null
      return { page, note: str(o.note) }
    })
    .filter((s) => s.page !== null || s.note)
  return {
    answer: str(raw.answer) || 'The AI did not return an answer. Please try again.',
    inDocument: raw.inDocument !== false,
    sources,
  }
}

/* ----------------------------------------------------------------- explain */
export const ASSISTANT_CONTEXTS = ['general', 'document', 'subject'] as const

export async function explainConcept(
  env: Bindings,
  args: {
    prompt: string
    context: string
    contextText: string
    mode: string
    language: string
    history: ChatTurn[]
  },
): Promise<string> {
  const mode = CHAT_MODES.includes(args.mode as (typeof CHAT_MODES)[number]) ? args.mode : 'simple'
  const language = mode === 'marathi' ? 'marathi' : args.language
  const contextNote = args.context === 'general' ? 'No study material is attached; use your general knowledge.' : args.contextText
  return generateText(env, {
    temperature: 0.4,
    maxOutputTokens: 3072,
    system: `You are a study assistant for students. ${MODE_BRIEF[mode]} ${languageInstruction(language)}
When study material is supplied inside <document> tags, ground your answer in it and say when something is not covered by it. You may also help with programming, revision plans, exam answers, practice MCQs and viva preparation. Use short Markdown sections. If the student asks for flashcards, quiz questions or a revision plan, format them as a clean list they can act on.`,
    prompt: `${args.context === 'general' ? '' : `<context>\n${contextNote}\n</context>\n\n`}${args.history
      .slice(-6)
      .map((h) => `${h.role === 'user' ? 'Student' : 'Assistant'}: ${h.content.slice(0, 1200)}`)
      .join('\n')}${args.history.length ? '\n\n' : ''}Student: ${args.prompt}`,
  })
}

/* -------------------------------------------------------------------- viva */
export type VivaQuestion = { id: string; question: string; topic: string; keywords: string[] }

export async function generateVivaQuestions(
  env: Bindings,
  args: { subject: string; topic: string; difficulty: string; count: number; language: string; text?: string },
): Promise<{ title: string; questions: VivaQuestion[] }> {
  const count = Math.min(Math.max(args.count, 3), 12)
  const material = args.text ? `\n\nBase the questions on this material where possible:\n${documentBlock(args.text, `${args.topic} viva questions`)}` : ''
  const raw = await generateJson<Record<string, unknown>>(env, {
    json: true,
    temperature: 0.5,
    maxOutputTokens: 4096,
    system: `You are a university examiner conducting an oral (viva) examination. Return JSON: {"title": string, "questions": [{"question": string, "topic": string, "keywords": string[]}]}.
Generate exactly ${count} ${args.difficulty} viva questions for the subject "${args.subject}" and topic "${args.topic}". The questions must run in a sensible order, from fundamentals to deeper reasoning, and be answerable verbally in 30-90 seconds. "keywords" lists 3-6 concepts a good answer should mention. ${languageInstruction(args.language)}`,
    prompt: `Subject: ${args.subject}\nTopic: ${args.topic}\nDifficulty: ${args.difficulty}\n\nCreate the viva questions now.${material}`,
  })
  const questions = arr(raw.questions)
    .map((q, i) => {
      const o = (q ?? {}) as Record<string, unknown>
      return {
        id: `v_${i}_${Math.random().toString(36).slice(2, 8)}`,
        question: str(o.question),
        topic: str(o.topic, args.topic),
        keywords: strings(o.keywords, 8),
      }
    })
    .filter((q) => q.question)
    .slice(0, count)
  if (!questions.length) throw new Error('The examiner could not prepare questions. Try again.')
  return { title: str(raw.title, `${args.subject} — ${args.topic}`), questions }
}

export type VivaEvaluation = {
  score: number
  accuracy: number
  understanding: number
  completeness: number
  correct: string[]
  missing: string[]
  idealAnswer: string
  feedback: string
}

export async function evaluateVivaAnswer(
  env: Bindings,
  args: { question: string; answer: string; keywords: string[]; difficulty: string; language: string },
): Promise<VivaEvaluation> {
  const raw = await generateJson<Record<string, unknown>>(env, {
    json: true,
    temperature: 0.2,
    maxOutputTokens: 2048,
    system: `You are a fair but rigorous viva examiner. Evaluate the student's spoken answer and return JSON:
{"score": number (0-10), "accuracy": number (0-10), "understanding": number (0-10), "completeness": number (0-10), "correct": string[], "missing": string[], "idealAnswer": string, "feedback": string}
Be specific: name what the student got right, what was missing or wrong, and give a concise ideal answer a good student would say out loud. Score relative to the requested difficulty (${args.difficulty}). Be encouraging but honest; do not inflate scores. ${languageInstruction(args.language)}`,
    prompt: `Question: ${args.question}\nKey concepts expected: ${args.keywords.join(', ') || 'n/a'}\n\nStudent's answer: ${args.answer || '(no answer given)'}`,
  })
  const clamp = (n: unknown) => Math.max(0, Math.min(10, Math.round(num(n))))
  return {
    score: clamp(raw.score),
    accuracy: clamp(raw.accuracy),
    understanding: clamp(raw.understanding),
    completeness: clamp(raw.completeness),
    correct: strings(raw.correct, 8),
    missing: strings(raw.missing, 8),
    idealAnswer: str(raw.idealAnswer),
    feedback: str(raw.feedback),
  }
}

/* ------------------------------------------------------------- study plan */
export async function generateStudyPlan(
  env: Bindings,
  args: {
    subjects: string[]
    examDate: string
    dailyMinutes: number
    topics: string[]
    language: string
  },
): Promise<{ tasks: { title: string; subject: string; topic: string; dueDate: string; minutes: number }[]; note: string }> {
  const today = new Date().toISOString().slice(0, 10)
  const raw = await generateJson<Record<string, unknown>>(env, {
    json: true,
    temperature: 0.3,
    maxOutputTokens: 4096,
    system: `Build a realistic, spaced study plan as JSON: {"tasks": [{"title": string, "subject": string, "topic": string, "dueDate": "YYYY-MM-DD", "minutes": number}], "note": string}.
Today is ${today}. The exam date is ${args.examDate}. The student can study about ${args.dailyMinutes} minutes per day. Never schedule more than slightly under the daily minutes across tasks on one day, include short revision slots, keep one rest day per week free of new topics, and never schedule tasks after the exam date or before today. Every dueDate must be a real date in that range. Use short task titles. ${languageInstruction(args.language)}`,
    prompt: `Subjects: ${args.subjects.join(', ') || 'general'}\nTopics to cover: ${args.topics.join(', ') || 'cover the syllabus'}\nDaily study time: ${args.dailyMinutes} minutes\nExam date: ${args.examDate}`,
  })
  const tasks = arr(raw.tasks)
    .map((t) => {
      const o = (t ?? {}) as Record<string, unknown>
      const dueDate = str(o.dueDate).slice(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || dueDate < today || dueDate > args.examDate) return null
      return {
        title: str(o.title),
        subject: str(o.subject, args.subjects[0] ?? 'General'),
        topic: str(o.topic),
        dueDate,
        minutes: Math.max(10, Math.min(240, Math.round(num(o.minutes, args.dailyMinutes)))),
      }
    })
    .filter((t): t is { title: string; subject: string; topic: string; dueDate: string; minutes: number } => Boolean(t?.title))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  return { tasks, note: str(raw.note) }
}
