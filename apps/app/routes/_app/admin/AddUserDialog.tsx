import { useState } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface AddUserValues {
  email: string
  name: string
  password: string
}

export interface AddUserDialogProps {
  open: boolean
  title: string
  pending: boolean
  onSubmit: (values: AddUserValues) => void | Promise<void>
  onClose: () => void
}

/**
 * Shared "add a user" dialog used by tenant onboarding: the super admin's
 * "Add admin" and the library admin's "Add member". Collects email, name and a
 * temporary password (no email service in Phase 1). The caller decides the role
 * and tenant; this is pure form + validation.
 */
export function AddUserDialog({ open, title, pending, onSubmit, onClose }: AddUserDialogProps) {
  const { t } = useLingui()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const em = email.trim()
    const nm = name.trim()
    if (!em || !nm || password.length < 8) return
    void onSubmit({ email: em, name: nm, password })
  }

  return (
    <Modal open={open} onClose={onClose} ariaLabel={title} data-testid="add-user-dialog">
      <form onSubmit={submit} className="space-y-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="space-y-2">
          <Label htmlFor="au-email">
            <Trans>Email</Trans>
          </Label>
          <Input
            id="au-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            data-testid="add-user-email"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="au-name">
            <Trans>Name</Trans>
          </Label>
          <Input
            id="au-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="add-user-name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="au-password">
            <Trans>Temporary password</Trans>
          </Label>
          <Input
            id="au-password"
            type="text"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t`At least 8 characters`}
            data-testid="add-user-password"
          />
          <p className="text-xs text-muted-foreground">
            <Trans>Share this with the user; they can change it after signing in.</Trans>
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            <Trans>Cancel</Trans>
          </Button>
          <Button type="submit" disabled={pending} data-testid="add-user-submit">
            {pending ? <Trans>Adding…</Trans> : <Trans>Add</Trans>}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
