import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useI18n } from '@/lib/i18n'

type ToastKind = 'success' | 'error' | 'info'
interface Toast {
  id: number
  kind: ToastKind
  message: string
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void
  success: (message: string) => void
  error: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const [toasts, setToasts] = useState<Toast[]>([])

  const remove = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const toast = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = nextId++
    setToasts((t) => [...t, { id, kind, message }])
  }, [])

  const value: ToastContextValue = {
    toast,
    success: (m) => toast(m, 'success'),
    error: (m) => toast(m, 'error'),
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed top-3 right-3 z-[60] flex w-[min(92vw,22rem)] flex-col gap-2"
        role="region"
        aria-label={t('common.notifications')}
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const { t } = useI18n()
  useEffect(() => {
    const timer = setTimeout(onDismiss, toast.kind === 'error' ? 6000 : 3500)
    return () => clearTimeout(timer)
  }, [onDismiss, toast.kind])

  const styles =
    toast.kind === 'success'
      ? 'border-green-200 bg-green-50 text-green-800'
      : toast.kind === 'error'
        ? 'border-destructive/30 bg-destructive/10 text-destructive'
        : 'border-input bg-card text-foreground'

  return (
    <div
      role={toast.kind === 'error' ? 'alert' : 'status'}
      data-testid="toast"
      className={`pointer-events-auto flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm shadow-md ${styles}`}
    >
      <span>{toast.message}</span>
      <button
        type="button"
        aria-label={t('common.dismiss')}
        onClick={onDismiss}
        className="shrink-0 opacity-60 hover:opacity-100"
      >
        ✕
      </button>
    </div>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    // Safe no-op fallback if used outside the provider (e.g. in isolated tests).
    return { toast: () => {}, success: () => {}, error: () => {} }
  }
  return ctx
}
