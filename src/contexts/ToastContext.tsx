import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'

type ToastKind = 'success' | 'error' | 'info'
type ToastItem = { id: number; kind: ToastKind; message: string }

const ToastContext = createContext<{
  toast: (message: string, kind?: ToastKind) => void
  success: (message: string) => void
  error: (message: string) => void
} | null>(null)

let nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const remove = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), [])

  const toast = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      const id = nextId++
      setItems((list) => [...list.slice(-3), { id, kind, message }])
      window.setTimeout(() => remove(id), kind === 'error' ? 7000 : 4200)
    },
    [remove],
  )

  const value = useMemo(
    () => ({
      toast,
      success: (message: string) => toast(message, 'success'),
      error: (message: string) => toast(message, 'error'),
    }),
    [toast],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-6"
        role="status"
        aria-live="polite"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className="animate-fade-up pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border border-line bg-bg-elevated px-4 py-3 shadow-float"
          >
            {item.kind === 'success' ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" />
            ) : item.kind === 'error' ? (
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-bad" />
            ) : (
              <Info className="mt-0.5 size-4 shrink-0 text-primary" />
            )}
            <p className="flex-1 text-sm text-ink-soft">{item.message}</p>
            <button
              onClick={() => remove(item.id)}
              className="rounded-md p-0.5 text-muted transition hover:bg-surface-2 hover:text-ink"
              aria-label="Dismiss notification"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
