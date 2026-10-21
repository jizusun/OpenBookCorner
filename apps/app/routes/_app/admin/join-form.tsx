import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useLingui } from '@lingui/react/macro'
import { Trash2 } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { EmptyState } from '@/components/ui/empty-state'
import { useToast } from '@/components/Toast'

export const Route = createFileRoute('/_app/admin/join-form')({
  beforeLoad: ({ context }) => {
    const { role } = context.user
    if (role !== 'library_admin' && role !== 'super_admin') throw redirect({ to: '/books' })
  },
  component: JoinFormPage,
})

const TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'select', label: 'Select' },
] as const

function JoinFormPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { t } = useLingui()
  const { data: fields = [] } = useQuery(api.join.adminFields.queryOptions())

  const [open, setOpen] = useState(false)
  const [key, setKey] = useState('')
  const [label, setLabel] = useState('')
  const [type, setType] = useState<'text' | 'email' | 'select'>('text')
  const [required, setRequired] = useState(true)
  const [verifyEmail, setVerifyEmail] = useState(false)

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['join', 'adminFields'] })

  const add = useMutation({
    ...api.join.addField.mutationOptions(),
    onSuccess: () => {
      toast.success(t`Field added.`)
      setKey(''); setLabel(''); setType('text'); setRequired(true); setVerifyEmail(false)
      setOpen(false)
      invalidate()
    },
  })

  const remove = useMutation({
    ...api.join.removeField.mutationOptions(),
    onSuccess: () => { toast.success(t`Field removed.`); invalidate() },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold"><Trans>Join form</Trans></h1>
          <p className="text-sm text-muted-foreground">
            <Trans>Fields applicants must fill before requesting to join this library.</Trans>
          </p>
        </div>
        <Button onClick={() => setOpen(true)} data-testid="join-form-add-open">
          <Trans>Add field</Trans>
        </Button>
      </div>

      {fields.length === 0 && (
        <EmptyState icon="📋" title={<Trans>No custom fields</Trans>}
          description={<Trans>Anyone can request to join without filling extra info.</Trans>} />
      )}

      {fields.length > 0 && (
        <div className="space-y-2">
          {fields.map((f) => (
            <Card key={f.id} data-testid={`join-field-${f.id}`}>
              <CardContent className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="font-medium">{f.label}</p>
                  <p className="text-xs text-muted-foreground">{f.key}</p>
                </div>
                <Badge variant="outline">{f.type}</Badge>
                {f.required && <Badge variant="secondary"><Trans>Required</Trans></Badge>}
                {f.verifyEmail && <Badge><Trans>Verify email</Trans></Badge>}
                <Button size="sm" variant="ghost" onClick={() => remove.mutate({ id: f.id })}
                  data-testid={`join-field-remove-${f.id}`}>
                  <Trash2 className="size-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} ariaLabel={t`Add join form field`}
        data-testid="join-field-dialog"
        title={<Trans>Add a field</Trans>}
        description={<Trans>Applicants must fill this field before submitting a request.</Trans>}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}><Trans>Cancel</Trans></Button>
            <Button type="submit" form="join-field-form" disabled={add.isPending}>
              {add.isPending ? <Trans>Adding…</Trans> : <Trans>Add field</Trans>}
            </Button>
          </>
        }
      >
        <form id="join-field-form" className="space-y-4"
          onSubmit={(e) => { e.preventDefault(); add.mutate({ key: key.trim(), label: label.trim(), type, required, verifyEmail }) }}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="jf-key"><Trans>Field key</Trans></Label>
              <Input id="jf-key" value={key} onChange={(e) => setKey(e.target.value)} placeholder="employee_id" required data-testid="jf-key" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jf-label"><Trans>Display label</Trans></Label>
              <Input id="jf-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Employee ID" required data-testid="jf-label" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="jf-type"><Trans>Type</Trans></Label>
            <select id="jf-type" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} data-testid="jf-required" />
              <Trans>Required</Trans>
            </label>
            {type === 'email' && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={verifyEmail} onChange={(e) => setVerifyEmail(e.target.checked)} data-testid="jf-verify" />
                <Trans>Verify email ownership</Trans>
              </label>
            )}
          </div>
        </form>
      </Modal>
    </div>
  )
}
