import { Link } from 'react-router'
import { Compass } from 'lucide-react'

import { Logo } from '../components/layout/Logo'
import { buttonClasses } from '../components/ui/Button'

export function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <div className="flex h-16 items-center border-b border-line px-4 sm:px-6">
        <Logo to="/" />
      </div>
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-line bg-surface text-primary shadow-soft">
            <Compass className="size-5" />
          </div>
          <p className="mt-5 text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">404</p>
          <h1 className="mt-2 text-[26px] font-semibold tracking-[-0.03em] text-ink">This page isn’t in the syllabus</h1>
          <p className="mx-auto mt-2 max-w-sm text-[13.5px] text-muted">
            The page you were looking for doesn’t exist or has moved. Head back to your study space.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <Link to="/app" className={buttonClasses('primary', 'md')}>
              Go to dashboard
            </Link>
            <Link to="/" className={buttonClasses('secondary', 'md')}>
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
