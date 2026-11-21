import type { Db } from './sql'

/**
 * Schema bootstrap. D1 has no migration runner at request time, and the app
 * must work in a fresh local database, so every table is created idempotently
 * once per isolate before the first request is served.
 */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'english',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  page_count INTEGER NOT NULL DEFAULT 0,
  extracted_text TEXT NOT NULL DEFAULT '',
  summary_json TEXT,
  upload_date TEXT NOT NULL,
  processing_status TEXT NOT NULL,
  error_message TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id, upload_date DESC);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  document_id TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'english',
  style TEXT NOT NULL DEFAULT 'detailed',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  document_id TEXT,
  title TEXT NOT NULL,
  messages TEXT NOT NULL DEFAULT '[]',
  mode TEXT NOT NULL DEFAULT 'simple',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chats_user ON chats(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS quizzes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  document_id TEXT,
  title TEXT NOT NULL,
  questions TEXT NOT NULL,
  answers TEXT,
  score INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'medium',
  weak_topics TEXT,
  time_taken INTEGER,
  created_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_quizzes_user ON quizzes(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS flashcards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  document_id TEXT,
  title TEXT NOT NULL,
  cards TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_flashcards_user ON flashcards(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS study_tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  topic TEXT,
  title TEXT NOT NULL,
  due_date TEXT,
  completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_user ON study_tasks(user_id, due_date);

CREATE TABLE IF NOT EXISTS study_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  subject TEXT,
  topic TEXT,
  duration INTEGER NOT NULL DEFAULT 0,
  source TEXT,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON study_sessions(user_id, date);

CREATE TABLE IF NOT EXISTS viva_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  questions TEXT NOT NULL DEFAULT '[]',
  evaluations TEXT NOT NULL DEFAULT '[]',
  score INTEGER,
  total INTEGER,
  created_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_viva_user ON viva_sessions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS password_resets (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ai_usage (
  user_id TEXT NOT NULL,
  day TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
`

let ready: Promise<void> | null = null

export function ensureSchema(db: Db): Promise<void> {
  if (!ready) {
    // D1's exec() splits on newlines, which breaks multi-line DDL, so each
    // statement is prepared and run individually instead.
    const statements = SCHEMA.split(';')
      .map((statement) => statement.trim())
      .filter(Boolean)
    ready = db
      .batch(statements.map((statement) => db.prepare(statement)))
      .then(() => undefined)
    // A failed bootstrap must not be cached forever (e.g. transient DB error).
    ready.catch(() => {
      ready = null
    })
  }
  return ready
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`
}

export function nowIso(): string {
  return new Date().toISOString()
}
