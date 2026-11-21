import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import {
  BookOpenCheck,
  CalendarDays,
  ChevronRight,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Layers,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Settings,
  Sparkles,
  Sun,
  TrendingUp,
  X,
} from 'lucide-react'

import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useTheme } from '../../hooks/useTheme'
import { cn } from '../../lib/cn'
import { initials } from '../../lib/format'
import { Assistant } from '../Assistant'
import { Logo } from './Logo'

const nav = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/documents', label: 'My documents', icon: FileText },
  { to: '/app/chat', label: 'AI chat', icon: MessageSquare },
  { to: '/app/notes', label: 'Notes', icon: BookOpenCheck },
  { to: '/app/quiz', label: 'Quizzes', icon: GraduationCap },
  { to: '/app/viva', label: 'Viva practice', icon: Sparkles },
  { to: '/app/flashcards', label: 'Flashcards', icon: Layers },
  { to: '/app/planner', label: 'Study planner', icon: CalendarDays },
  { to: '/app/progress', label: 'Progress', icon: TrendingUp },
]

export function AppLayout() {
  const { user, signOut } = useAuth()
  const { theme, toggle } = useTheme()
  const { success } = useToast()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between px-5">
        <Logo />
        <button
          onClick={() => setMobileOpen(false)}
          className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-ink lg:hidden"
          aria-label="Close navigation"
        >
          <X className="size-4" />
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4 scroll-thin" aria-label="Main navigation">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors',
                isActive
                  ? 'bg-primary-soft text-primary'
                  : 'text-ink-soft hover:bg-surface-2 hover:text-ink',
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={cn('size-[17px]', isActive ? 'text-primary' : 'text-muted group-hover:text-ink')} />
                <span className="flex-1">{item.label}</span>
                {isActive ? <ChevronRight className="size-3.5 opacity-60" /> : null}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-line p-3">
        <NavLink
          to="/app/settings"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors',
              isActive ? 'bg-primary-soft text-primary' : 'text-ink-soft hover:bg-surface-2 hover:text-ink',
            )
          }
        >
          <Settings className="size-[17px] text-muted" />
          Profile & settings
        </NavLink>

        <div className="mt-2 flex items-center gap-2 rounded-xl border border-line bg-surface-2 p-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-[12px] font-semibold text-on-primary">
            {initials(user?.name ?? 'Student')}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-medium text-ink">{user?.name}</p>
            <p className="truncate text-[11px] text-muted">{user?.email}</p>
          </div>
          <button
            onClick={() => {
              signOut()
              success('You have been signed out.')
            }}
            className="rounded-md p-1.5 text-muted transition hover:bg-surface-3 hover:text-bad"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-dvh bg-bg">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] border-r border-line bg-bg-elevated lg:block">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-black/50" onClick={() => setMobileOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-[270px] animate-fade-in border-r border-line bg-bg-elevated shadow-float">
            {sidebar}
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-bg/85 px-4 backdrop-blur-md sm:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-ink lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </button>
          <div className="lg:hidden">
            <Logo to="/app" compact />
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={toggle}
              className="rounded-lg p-2 text-muted transition hover:bg-surface-2 hover:text-ink"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'dark' ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
            </button>
            <Link
              to="/app/documents"
              className="hidden items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[13px] font-medium text-on-primary transition hover:bg-primary-hover sm:inline-flex"
            >
              <FileText className="size-4" />
              Upload
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-6 sm:py-8">
          <Outlet />
        </main>
      </div>

      <Assistant />
    </div>
  )
}
