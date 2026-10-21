import { type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface ModalProps {
  open: boolean
  onClose: () => void
  /**
   * Accessible label. When `title` is omitted it's rendered as a
   * visually-hidden DialogTitle (back-compat for callers with their own
   * heading). When `title` is provided it becomes the visible DialogTitle.
   */
  ariaLabel: string
  /** Visible dialog title (shadcn-admin style header). */
  title?: ReactNode
  /** Optional sub-description under the title. */
  description?: ReactNode
  /** Footer actions (e.g. Cancel + Submit), right-aligned. */
  footer?: ReactNode
  children: ReactNode
  'data-testid'?: string
}

/**
 * Accessible modal on the shadcn/Radix Dialog. Pass `title`/`description`/
 * `footer` to get the shadcn-admin structured look (header on top, content,
 * footer actions bottom-right). Without them it renders bare children with a
 * visually-hidden title (back-compat). Esc / outside-click / focus trap +
 * restore are handled by Radix.
 */
export function Modal({
  open,
  onClose,
  ariaLabel,
  title,
  description,
  footer,
  children,
  ...rest
}: ModalProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent data-testid={rest['data-testid']} className="sm:max-w-md">
        {title ? (
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
        ) : (
          <DialogTitle className="sr-only">{ariaLabel}</DialogTitle>
        )}
        {children}
        {footer && <DialogFooter>{footer}</DialogFooter>}
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

/**
 * Confirmation dialog on the shadcn AlertDialog (the semantic "are you sure"
 * dialog, matching shadcn-admin's ConfirmDialog). Replaces window.confirm for
 * destructive actions.
 */
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
    <AlertDialog open={open} onOpenChange={(next) => (!next ? onCancel() : undefined)}>
      <AlertDialogContent data-testid="confirm-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>
            {cancelLabel}
          </AlertDialogCancel>
          <Button
            type="button"
            variant={destructive ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={pending}
            data-testid="confirm-dialog-confirm"
          >
            {pending ? 'Working…' : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
