import { useEffect, useRef, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'

interface ModalProps {
  open: boolean
  onClose: () => void
  /** Accessible label for the dialog (used as aria-label when no titled header is present). */
  ariaLabel: string
  children: ReactNode
  'data-testid'?: string
}

/**
 * Accessible modal: Esc to close, click-outside to close, focus trap, and
 * autofocus of the first focusable element. Restores focus to the trigger on close.
 */
export function Modal({ open, onClose, ariaLabel, children, ...rest }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  // Keep the latest onClose in a ref so the focus/trap effect depends ONLY on
  // `open`. If `onClose` were a dependency, a parent that recreates the handler
  // on every render (e.g. a form updating state on each keystroke) would re-run
  // this effect and re-autofocus the first element — stealing focus mid-typing.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return
    previouslyFocused.current = document.activeElement as HTMLElement | null

    const panel = panelRef.current
    // Autofocus the first focusable element (or the panel itself).
    const focusables = () =>
      panel
        ? Array.from(
            panel.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
            ),
          ).filter((el) => el.offsetParent !== null)
        : []
    const first = focusables()[0]
    ;(first ?? panel)?.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current()
        return
      }
      if (e.key === 'Tab') {
        const items = focusables()
        if (items.length === 0) return
        const firstEl = items[0]
        const lastEl = items[items.length - 1]
        if (!firstEl || !lastEl) return
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault()
          lastEl.focus()
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault()
          firstEl.focus()
        }
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previouslyFocused.current?.focus?.()
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className="w-full max-w-md rounded-lg border bg-card p-6 shadow-xl outline-none"
        onClick={(e) => e.stopPropagation()}
        data-testid={rest['data-testid']}
      >
        {children}
      </div>
    </div>
  )
}

interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  pending?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Styled confirmation dialog that replaces window.confirm for destructive actions. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive,
  pending,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} ariaLabel={title} data-testid="confirm-dialog">
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={pending}
            data-testid="confirm-dialog-confirm"
          >
            {pending ? 'Working…' : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
