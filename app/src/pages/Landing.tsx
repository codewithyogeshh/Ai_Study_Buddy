import {
  ArrowRight,
  BookOpenCheck,
  BrainCircuit,
  CalendarDays,
  Check,
  FileText,
  GraduationCap,
  Languages,
  Layers,
  MessageSquare,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  Upload,
} from 'lucide-react'
import { Link } from 'react-router'

import { Logo } from '../components/layout/Logo'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../hooks/useTheme'
import { buttonClasses } from '../components/ui/Button'

const features = [
  {
    icon: FileText,
    title: 'Turn PDFs into knowledge',
    body: 'Upload a PDF, DOCX or TXT. Get an instant summary, key concepts, definitions and likely exam questions, with page-aware citations.',
  },
  {
    icon: BookOpenCheck,
    title: 'Notes that fit how you revise',
    body: 'Short, detailed, exam-oriented, chapter-wise or revision notes — in English, Marathi or Hindi, ready to edit and export.',
  },
  {
    icon: MessageSquare,
    title: 'Ask your own material',
    body: 'Chat grounded in your document. If the answer is not there, the assistant says so instead of inventing one.',
  },
  {
    icon: GraduationCap,
    title: 'Practice, not just reading',
    body: 'Generate MCQ, true/false or mixed quizzes at three difficulty levels, with explanations and weak-topic analysis.',
  },
  {
    icon: Sparkles,
    title: 'Viva with a real examiner',
    body: 'An AI examiner asks one question at a time, scores your spoken answer and shows exactly what you missed.',
  },
  {
    icon: Layers,
    title: 'Flashcards & a study plan',
    body: 'Flip, shuffle and re-study difficult cards. Build a realistic schedule around your exam date.',
  },
]

const steps = [
  { title: 'Upload your material', body: 'Drop in lecture notes, a textbook chapter or your syllabus.' },
  { title: 'Let the AI analyse it', body: 'Get a structured summary, topics and definitions in seconds.' },
  { title: 'Study with active recall', body: 'Ask questions, take quizzes, practise viva and track your progress.' },
]

const capabilities = [
  'Document summarisation',
  'Chapter-wise notes',
  'Grounded Q&A with page references',
  'MCQ, true/false and mixed quizzes',
  'Oral exam simulation',
  'Flashcards from chapters',
  'Realistic study plans',
  'English, Marathi and Hindi',
  'Speech-to-text and read-aloud',
]

export function Landing() {
  const { user } = useAuth()
  const { theme, toggle } = useTheme()
  const startPath = user ? '/app' : '/register'

  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/65 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo to="/" />
          <nav className="hidden items-center gap-7 text-[13px] font-medium text-ink-soft md:flex">
            <a href="#features" className="transition hover:text-ink">
              Features
            </a>
            <a href="#how" className="transition hover:text-ink">
              How it works
            </a>
            <a href="#ai" className="transition hover:text-ink">
              AI capabilities
            </a>
            <a href="#students" className="transition hover:text-ink">
              For students
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <button
              onClick={toggle}
              className="rounded-lg p-2 text-muted transition hover:bg-surface-2 hover:text-ink"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
            </button>
            {user ? (
              <Link to="/app" className={buttonClasses('primary', 'sm')}>
                Open dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className={buttonClasses('ghost', 'sm', 'hidden sm:inline-flex')}>
                  Sign in
                </Link>
                <Link to="/register" className={buttonClasses('primary', 'sm')}>
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
            <div className="absolute -top-64 left-1/2 size-[860px] -translate-x-1/2 rounded-full bg-primary/20 blur-[150px] opacity-80" />
            <div className="absolute -top-40 right-[-12%] size-[460px] rounded-full bg-accent/15 blur-[140px]" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
          </div>
          <div className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pb-24 sm:pt-20">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary-soft/80 px-3 py-1 text-[12px] font-medium text-primary shadow-soft backdrop-blur-sm">
                <Sparkles className="size-3.5" />
                Your personal AI learning companion
              </span>
              <h1 className="mt-5 text-balance text-[34px] font-semibold leading-[1.08] tracking-[-0.035em] text-ink sm:text-[54px]">
                Study Smarter. Learn Faster. <span className="text-gradient">Remember Better.</span>
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-pretty text-[15px] leading-relaxed text-muted sm:text-[17px]">
                Your personal AI study companion that transforms your PDFs into notes, quizzes, flashcards, and
                interactive learning experiences.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link to={startPath} className={buttonClasses('primary', 'lg', 'w-full sm:w-auto')}>
                  Get started free
                  <ArrowRight className="size-4" />
                </Link>
                <Link to={user ? '/app/documents' : '/login'} className={buttonClasses('secondary', 'lg', 'w-full sm:w-auto')}>
                  <Upload className="size-4" />
                  Upload a document
                </Link>
              </div>
              <p className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[12px] text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="size-3.5 text-ok" /> No credit card
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="size-3.5 text-ok" /> Your documents stay private
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="size-3.5 text-ok" /> English, मराठी, हिन्दी
                </span>
              </p>
            </div>

            {/* Product preview */}
            <div className="mx-auto mt-14 max-w-5xl animate-fade-up">
              <div className="overflow-hidden rounded-[22px] border border-line/80 bg-surface shadow-float ring-1 ring-black/5 dark:ring-white/5">
                <div className="flex items-center gap-2 border-b border-line bg-surface-2/70 px-4 py-2.5">
                  <span className="size-2.5 rounded-full bg-bad/60" />
                  <span className="size-2.5 rounded-full bg-warn/60" />
                  <span className="size-2.5 rounded-full bg-ok/60" />
                  <span className="ml-3 rounded-md bg-surface px-2 py-0.5 text-[10.5px] text-muted">AI Study Buddy · dashboard</span>
                </div>
                <div className="grid gap-3 p-4 sm:grid-cols-[200px_1fr] sm:p-5">
                  <aside className="hidden space-y-1.5 border-r border-line pr-3 sm:block">
                    {['Dashboard', 'My documents', 'AI chat', 'Notes', 'Quizzes', 'Viva practice', 'Flashcards', 'Progress'].map(
                      (item, i) => (
                        <div
                          key={item}
                          className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11.5px] ${
                            i === 0 ? 'bg-primary-soft font-medium text-primary' : 'text-muted'
                          }`}
                        >
                          <span className={`size-1.5 rounded-full ${i === 0 ? 'bg-primary' : 'bg-line-strong'}`} />
                          {item}
                        </div>
                      ),
                    )}
                  </aside>
                  <div className="grid gap-3">
                    <div className="rounded-xl border border-line bg-surface-2/50 p-3.5">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-muted">Analysis ready</p>
                      <p className="mt-1.5 text-[13px] font-medium text-ink">Operating Systems — Unit 3</p>
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {['Deadlocks', 'Scheduling', 'Semaphores', 'Paging'].map((t) => (
                          <span key={t} className="rounded-full border border-line bg-surface px-2 py-0.5 text-[10.5px] text-muted">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {[
                        { label: 'Summary', icon: FileText },
                        { label: 'Practice quiz', icon: GraduationCap },
                        { label: 'Viva questions', icon: Sparkles },
                      ].map((tile) => (
                        <div key={tile.label} className="rounded-xl border border-line bg-surface p-3">
                          <tile.icon className="size-4 text-primary" />
                          <p className="mt-2 text-[11.5px] font-medium text-ink">{tile.label}</p>
                          <div className="mt-2 space-y-1">
                            <div className="h-1.5 w-full rounded-full bg-surface-3" />
                            <div className="h-1.5 w-4/5 rounded-full bg-surface-3" />
                            <div className="h-1.5 w-2/3 rounded-full bg-surface-3" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-center text-[11px] text-muted">A preview of the workspace — every feature is live in the app.</p>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-t border-line bg-bg-elevated py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-primary">Everything in one place</p>
              <h2 className="mt-2 text-[26px] font-semibold tracking-[-0.03em] text-ink sm:text-[34px]">
                One study space instead of ten tabs
              </h2>
              <p className="mt-3 text-[14.5px] text-muted">
                Reading, revising, testing yourself and planning all draw from the same uploaded material, so nothing
                gets lost between apps.
              </p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="group rounded-2xl border border-line bg-surface p-5 shadow-soft transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-line-strong hover:shadow-raised"
                >
                  <div className="flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary ring-1 ring-primary/10 transition-transform duration-300 group-hover:scale-105">
                    <feature.icon className="size-4.5" />
                  </div>
                  <h3 className="mt-4 text-[14.5px] font-semibold text-ink">{feature.title}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{feature.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-primary">How it works</p>
                <h2 className="mt-2 text-[26px] font-semibold tracking-[-0.03em] text-ink sm:text-[34px]">
                  From a PDF to a study session in minutes
                </h2>
                <p className="mt-3 text-[14.5px] text-muted">
                  No prompt engineering needed. Choose a document, pick what you want to practise, and the assistant does
                  the structuring.
                </p>
                <Link to={startPath} className={buttonClasses('primary', 'md', 'mt-6')}>
                  Try it with your notes
                  <ArrowRight className="size-4" />
                </Link>
              </div>
              <ol className="relative space-y-4 border-l border-line pl-6">
                {steps.map((step, i) => (
                  <li key={step.title} className="relative rounded-2xl border border-line bg-surface p-5 shadow-soft transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-raised">
                    <span className="absolute -left-[35px] top-5 flex size-6 items-center justify-center rounded-full border border-primary/20 bg-primary-soft text-[11px] font-semibold text-primary shadow-soft">
                      {i + 1}
                    </span>
                    <h3 className="text-[14px] font-semibold text-ink">{step.title}</h3>
                    <p className="mt-1 text-[13px] text-muted">{step.body}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* AI capabilities */}
        <section id="ai" className="border-y border-line bg-bg-elevated py-16 sm:py-20">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-primary">AI capabilities</p>
              <h2 className="mt-2 text-[26px] font-semibold tracking-[-0.03em] text-ink sm:text-[34px]">
                Grounded in your material, honest about the gaps
              </h2>
              <p className="mt-3 text-[14.5px] leading-relaxed text-muted">
                The assistant is instructed to answer from your uploaded document first. If something is not there, it
                tells you — and keeps general knowledge clearly separate. It never invents page numbers.
              </p>
              <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-line bg-surface p-4">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ok" />
                <p className="text-[12.5px] leading-relaxed text-muted">
                  Document text is treated as untrusted data, so instructions hidden inside a PDF cannot change the
                  assistant's rules. API keys stay on the server.
                </p>
              </div>
            </div>
            <ul className="grid gap-2.5 sm:grid-cols-2">
              {capabilities.map((capability) => (
                <li key={capability} className="flex items-start gap-2 rounded-xl border border-line bg-surface px-3 py-2.5 text-[12.5px] text-ink-soft transition-colors duration-200 hover:border-primary/25 hover:text-ink">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  {capability}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Benefits */}
        <section id="students" className="py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  icon: BrainCircuit,
                  title: 'Active recall, not rereading',
                  body: 'Quizzes and viva questions force retrieval, the study technique with the strongest evidence behind it.',
                },
                {
                  icon: Languages,
                  title: 'Learn in your language',
                  body: 'Choose English, Marathi or Hindi. Technical terms stay in English so exams are still easy to write.',
                },
                {
                  icon: CalendarDays,
                  title: 'A plan you can actually follow',
                  body: 'The planner respects your available hours and exam date, with revision slots and rest days.',
                },
              ].map((benefit) => (
                <div key={benefit.title} className="rounded-2xl border border-line bg-surface p-6 shadow-soft transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-line-strong hover:shadow-raised">
                  <benefit.icon className="size-5 text-primary" />
                  <h3 className="mt-3 text-[15px] font-semibold text-ink">{benefit.title}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{benefit.body}</p>
                </div>
              ))}
            </div>

            <div className="btn-primary relative mt-12 overflow-hidden rounded-3xl border border-white/10 px-6 py-12 text-center sm:px-12">
              <div
                className="pointer-events-none absolute inset-0 opacity-60"
                aria-hidden
                style={{ background: 'radial-gradient(70% 120% at 50% -20%, rgb(255 255 255 / 0.28), transparent 60%)' }}
              />
              <h2 className="text-[24px] font-semibold tracking-[-0.02em] text-on-primary sm:text-[30px]">
                Your next exam starts with one upload
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-[13.5px] text-on-primary/80">
                Create a free account, upload your first chapter, and see your summary, notes and a practice quiz in
                minutes.
              </p>
              <Link
                to={startPath}
                className="relative mt-6 inline-flex items-center gap-2 rounded-xl bg-bg-elevated px-5 py-2.5 text-[13.5px] font-medium text-primary shadow-soft transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-raised active:translate-y-0"
              >
                {user ? 'Open your dashboard' : 'Create your free account'}
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-bg-elevated py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 sm:px-6 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xs">
            <Logo to="/" />
            <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
              Your personal AI learning companion. Built for students who want to understand more in less time.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 text-[12.5px] sm:grid-cols-3">
            <div>
              <p className="font-medium text-ink">Product</p>
              <ul className="mt-2.5 space-y-1.5 text-muted">
                <li>
                  <a href="#features" className="hover:text-ink">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#how" className="hover:text-ink">
                    How it works
                  </a>
                </li>
                <li>
                  <Link to={startPath} className="hover:text-ink">
                    Get started
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-ink">Study tools</p>
              <ul className="mt-2.5 space-y-1.5 text-muted">
                <li>
                  <Link to="/app/documents" className="hover:text-ink">
                    Documents
                  </Link>
                </li>
                <li>
                  <Link to="/app/quiz" className="hover:text-ink">
                    Quizzes
                  </Link>
                </li>
                <li>
                  <Link to="/app/viva" className="hover:text-ink">
                    Viva practice
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-ink">Account</p>
              <ul className="mt-2.5 space-y-1.5 text-muted">
                <li>
                  <Link to="/login" className="hover:text-ink">
                    Sign in
                  </Link>
                </li>
                <li>
                  <Link to="/register" className="hover:text-ink">
                    Create account
                  </Link>
                </li>
                <li>
                  <Link to="/forgot-password" className="hover:text-ink">
                    Reset password
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mx-auto mt-8 max-w-6xl border-t border-line px-4 pt-5 text-[11.5px] text-muted sm:px-6">
          © {new Date().getFullYear()} AI Study Buddy. Study smarter, not longer.
        </div>
      </footer>
    </div>
  )
}
