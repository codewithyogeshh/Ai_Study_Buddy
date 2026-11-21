export type User = {
  id: string
  name: string
  email: string
  language: Language
  createdAt: string
}

export type Language = 'english' | 'marathi' | 'hindi'

export type DocSummary = {
  id: string
  filename: string
  fileType: 'pdf' | 'txt' | 'docx'
  fileSize: number
  pageCount: number
  uploadDate: string
  processingStatus: string
  errorMessage: string | null
  hasAnalysis: boolean
  textLength: number
  wordCount: number
}

export type Analysis = {
  summary: string
  topics: string[]
  concepts: string[]
  definitions: { term: string; meaning: string }[]
  keyPoints: string[]
  examQuestions: string[]
  chapters: { title: string; summary: string }[]
}

export type DocumentDetail = DocSummary & {
  analysis: Analysis | null
  textPreview: string
}

export type Note = {
  id: string
  documentId: string | null
  title: string
  content: string
  language: Language | string
  style: string
  createdAt: string
  updatedAt: string
}

export type ChatSource = { page: number | null; note: string }

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  at: string
  inDocument?: boolean
  sources?: ChatSource[]
}

export type Chat = {
  id: string
  documentId: string | null
  title: string
  mode: string
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
}

export type ChatListItem = {
  id: string
  title: string
  documentId: string | null
  mode: string
  messageCount: number
  lastMessage: string
  updatedAt: string
}

export type QuizQuestion = {
  id: string
  question: string
  options: string[]
  topic: string
  correctIndex?: number
  explanation?: string
}

export type Quiz = {
  id: string
  documentId: string | null
  title: string
  difficulty: string
  totalQuestions: number
  score: number
  completed: boolean
  completedAt: string | null
  timeTaken: number | null
  weakTopics: string[]
  createdAt: string
  questions: QuizQuestion[]
  result?: QuizResult
}

export type GradedQuestion = {
  questionId: string
  question: string
  options: string[]
  selectedIndex: number | null
  correctIndex: number
  correct: boolean
  explanation: string
  topic: string
}

export type QuizResult = {
  score: number
  total: number
  percentage: number
  graded: GradedQuestion[]
  weakTopics: string[]
  summary: string
}

export type QuizListItem = {
  id: string
  title: string
  documentId: string | null
  difficulty: string
  totalQuestions: number
  score: number
  completed: boolean
  completedAt: string | null
  createdAt: string
}

export type Flashcard = {
  id: string
  front: string
  back: string
  topic: string
  confidence?: 'easy' | 'hard'
}

export type Deck = {
  id: string
  documentId: string | null
  title: string
  cards: Flashcard[]
  createdAt: string
}

export type StudyTask = {
  id: string
  subject: string
  topic: string
  title: string
  dueDate: string | null
  completed: boolean
  createdAt: string
}

export type VivaQuestion = { id: string; question: string; topic: string; keywords: string[] }

export type VivaEvaluation = {
  questionId: string
  question: string
  answer: string
  score: number
  accuracy: number
  understanding: number
  completeness: number
  correct: string[]
  missing: string[]
  idealAnswer: string
  feedback: string
  at: string
}

export type VivaSession = {
  id: string
  subject: string
  topic: string
  difficulty: string
  questions: VivaQuestion[]
  evaluations: VivaEvaluation[]
  score: number | null
  total: number | null
  completed: boolean
  completedAt: string | null
  createdAt: string
  nextIndex: number
}

export type VivaSummary = {
  averageScore: number
  strengths: string[]
  weakTopics: string[]
  practiceAgain: string[]
  verdict: string
  questionsAsked?: number
}

export type ActivityDay = { date: string; minutes: number; sessions: number; quizzes?: number }

export type DashboardData = {
  stats: {
    documents: number
    quizzesCompleted: number
    averageScore: number
    notes: number
    flashcardDecks: number
    tasksTotal: number
    tasksCompleted: number
    studyMinutes: number
    studySessions: number
    studyStreak: number
  }
  recentDocuments: {
    id: string
    filename: string
    fileType: string
    pageCount: number
    uploadDate: string
    processingStatus: string
    hasAnalysis: boolean
  }[]
  recentQuizzes: {
    id: string
    title: string
    score: number
    totalQuestions: number
    percentage: number
    completed: boolean
    completedAt: string | null
    createdAt: string
  }[]
  upcomingTasks: { id: string; title: string; subject: string; topic: string; dueDate: string | null; completed: boolean }[]
  activity: ActivityDay[]
  frequentTopics: { topic: string; count: number }[]
  weakTopics: { topic: string; count: number }[]
}

export type ProgressData = {
  totals: {
    quizzes: number
    averageScore: number
    bestScore: number
    tasksCompleted: number
    tasksTotal: number
    documents: number
    pagesRead: number
    studyMinutes: number
  }
  quizHistory: { id: string; title: string; date: string; percentage: number; score: number; total: number }[]
  topics: { topic: string; correct: number; total: number; percentage: number }[]
  weakTopics: { topic: string; count: number }[]
  activity: ActivityDay[]
  bySource: { source: string; count: number }[]
}
