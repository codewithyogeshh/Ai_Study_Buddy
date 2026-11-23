import type { ReactNode } from 'react'
import { AlertTriangle, Info, Loader2 } from 'lucide-react'

import { cn } from '../../lib/cn'

export function Card({ className, children, ...props }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'min-w-0 rounded-2xl border border-line bg-surface shadow-soft transition-[box-shadow,border-color] duration-300',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  icon?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3 px-5 pt-5', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <div className="mt-0.5 rounded-xl bg-primary-soft p-2 text-primary ring-1 ring-primary/10">{icon}</div>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-ink">{title}</h2>
          {description ? <p className="mt-0.5 text-[13px] text-muted">{description}</p> : null}
        </div>
      </div>
      {action}
    </div>
  )
}

type Tone = 'neutral' | 'primary' | 'success' | 'warn' | 'danger'

const tones: Record<Tone, string> = {
  neutral: 'border-line bg-surface-2 text-muted',
  primary: 'border-primary/20 bg-primary-soft text-primary',
  success: 'border-ok/20 bg-ok-soft text-ok',
  warn: 'border-warn/25 bg-warn-soft text-warn',
  danger: 'border-bad/20 bg-bad-soft text-bad',
}

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] font-medium leading-5',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Alert({
  children,
  tone = 'info',
  title,
  className,
  action,
}: {
  children?: ReactNode
  tone?: 'info' | 'warn' | 'error' | 'success'
  title?: string
  className?: string
  action?: ReactNode
}) {
  const styles = {
    info: 'border-primary/20 bg-primary-soft text-ink-soft',
    warn: 'border-warn/25 bg-warn-soft text-ink-soft',
    error: 'border-bad/25 bg-bad-soft text-ink-soft',
    success: 'border-ok/25 bg-ok-soft text-ink-soft',
  }[tone]
  const Icon = tone === 'error' || tone === 'warn' ? AlertTriangle : Info
  const iconColor = tone === 'error' ? 'text-bad' : tone === 'warn' ? 'text-warn' : tone === 'success' ? 'text-ok' : 'text-primary'
  return (
    <div className={cn('flex items-start gap-3 rounded-xl border px-4 py-3 text-[13px]', styles, className)} role="alert">
      <Icon className={cn('mt-0.5 size-4 shrink-0', iconColor)} />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-medium text-ink">{title}</p> : null}
        {children ? <div className={title ? 'mt-0.5' : undefined}>{children}</div> : null}
      </div>
      {action}
    </div>
  )
}

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-sm text-muted', className)}>
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {label ? <span>{label}</span> : <span className="sr-only">Loading</span>}
    </span>
  )
}

export function Progress({ value, className, tone = 'primary' }: { value: number; className?: string; tone?: 'primary' | 'success' | 'danger' }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div
      className={cn('h-2 w-full overflow-hidden rounded-full bg-surface-3', className)}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn(
          'h-full rounded-full transition-all duration-700 ease-out',
          tone === 'success' ? 'bg-ok' : tone === 'danger' ? 'bg-bad' : 'bg-primary',
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      {icon ? (
        <div className="mb-4 flex size-12 items-center justify-center rounded-2xl border border-line bg-surface-2 text-muted shadow-soft">
          {icon}
        </div>
      ) : null}
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      {description ? <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-surface-3', className)} />
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-balance text-[23px] font-semibold tracking-[-0.03em] text-ink sm:text-[28px]">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  className,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string; icon?: ReactNode }[]
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <div className={cn('inline-flex flex-wrap gap-1 rounded-xl border border-line bg-surface-2 p-1', className)} role="tablist">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg font-medium transition-[background-color,color,box-shadow] duration-200',
            size === 'sm' ? 'px-2.5 py-1 text-[12px]' : 'px-3 py-1.5 text-[12.5px]',
            value === option.value
              ? 'bg-surface text-ink shadow-soft'
              : 'text-muted hover:text-ink',
          )}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  )
}
