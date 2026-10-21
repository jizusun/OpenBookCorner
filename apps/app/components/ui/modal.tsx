import { type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

interface ModalProps {
  open: boolean
  onClose: () => void
  /** Accessible label for the dialog (used as the visually-hidden dialog title). */
  ariaLabel: string
  children: ReactNode
  'data-testid'?: string
}

/**
 * Accessible modal built on the shadcn/Radix Dialog: overlay + animation, Esc
 * and outside-click to close, focus trap, and focus restore are handled by
 * Radix. The public API (open/onClose/ariaLabel/children/data-testid) is
 * unchanged so existing call sites keep working. Callers render their own
 * heading inside `children`; `ariaLabel` is exposed as a visually-hidden
 * DialogTitle to satisfy Radix's a11y requirement.
 */
export function Modal({ open, onClose, ariaLabel, children, ...rest }: ModalProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent data-testid={rest['data-testid']} className="sm:max-w-md">
        <DialogTitle className="sr-only">{ariaLabel}</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
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
