import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { BookOpenCheck, GraduationCap, Sparkles } from 'lucide-react'

import { Logo } from './Logo'

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <div className="grid min-h-dvh bg-bg lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden border-r border-line bg-bg-elevated p-10 lg:flex lg:flex-col">
        <div className="hero-glow absolute inset-0" aria-hidden />
        <div className="pointer-events-none absolute -left-24 bottom-[-10%] size-[420px] rounded-full bg-accent/10 blur-[120px]" aria-hidden />
        <div className="relative">
          <Logo to="/" />
        </div>
        <div className="relative my-auto max-w-md">
          <h2 className="text-[30px] font-semibold leading-[1.15] tracking-[-0.03em] text-ink">
            Everything you need to actually remember what you study.
          </h2>
          <div className="mt-8 space-y-4">
            {[
              { icon: BookOpenCheck, title: 'Your documents, understood', body: 'Summaries, key concepts and definitions from your own PDFs.' },
              { icon: GraduationCap, title: 'Practice that adapts', body: 'Quizzes and viva questions built from your material.' },
              { icon: Sparkles, title: 'An assistant that is honest', body: 'Grounded answers with page references — no invented facts.' },
            ].map((item) => (
              <div key={item.title} className="flex gap-3 rounded-xl border border-line bg-surface/80 p-4 shadow-soft backdrop-blur-sm transition-[box-shadow,border-color] duration-300 hover:border-line-strong hover:shadow-raised">
                <item.icon className="mt-0.5 size-4 shrink-0 text-primary" />
                <div>
                  <p className="text-[13px] font-medium text-ink">{item.title}</p>
                  <p className="mt-0.5 text-[12.5px] text-muted">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-[11.5px] text-muted">AI Study Buddy — your personal AI learning companion.</p>
      </div>

      {/* Form panel */}
      <div className="flex flex-col">
        <div className="flex h-16 items-center justify-between border-b border-line px-4 sm:px-6 lg:hidden">
          <Logo to="/" />
        </div>
        <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
          <div className="w-full max-w-[400px] animate-fade-up">
            <h1 className="text-[24px] font-semibold tracking-[-0.025em] text-ink">{title}</h1>
            <p className="mt-1.5 text-[13.5px] text-muted">{subtitle}</p>
            <div className="mt-7">{children}</div>
            <div className="mt-6 text-[13px] text-muted">{footer}</div>
          </div>
        </div>
        <div className="px-4 pb-6 text-center text-[11.5px] text-muted sm:px-6">
          By continuing you agree to use AI Study Buddy responsibly.{' '}
          <Link to="/" className="underline underline-offset-2 hover:text-ink">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}
