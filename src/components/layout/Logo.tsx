import { Link } from 'react-router'

import { cn } from '../../lib/cn'

export function Logo({ compact = false, to = '/app', className }: { compact?: boolean; to?: string; className?: string }) {
  return (
    <Link to={to} className={cn('inline-flex items-center gap-2.5', className)} aria-label="AI Study Buddy home">
      <span className="relative flex size-8 items-center justify-center rounded-[10px] bg-primary text-[15px] font-bold text-on-primary shadow-soft">
        A
        <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full border-2 border-bg bg-warn" />
      </span>
      {compact ? null : (
        <span className="flex flex-col leading-none">
          <span className="text-[14.5px] font-semibold tracking-[-0.02em] text-ink">AI Study Buddy</span>
          <span className="mt-1 text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted">Learn smarter</span>
        </span>
      )}
    </Link>
  )
}
