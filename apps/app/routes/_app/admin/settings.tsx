import { useState } from 'react'
import { FormPageSkeleton } from '@/components/ui/skeleton'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useLingui } from '@lingui/react/macro'
import { Trash2 } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { EmptyState } from '@/components/ui/empty-state'
import { useToast } from '@/components/Toast'

export const Route = createFileRoute('/_app/admin/settings')({
  pendingComponent: () => <FormPageSkeleton />,
  beforeLoad: ({ context }) => {
    const user = context.user
    if (user.role !== 'library_admin' && user.role !== 'super_admin') {
      throw redirect({ to: '/books' })
    }
  },
  component: SettingsPage,
})

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'select', label: 'Select' },
] as const

/** Common fields derived from 番薯 member schema — admins can pick one preset
 *  instead of typing key/label from scratch. */
const FIELD_PRESETS = [
  { key: 'employee_no', label: '工号', type: 'text' as const },
  { key: 'department', label: '部门', type: 'text' as const },
  { key: 'student_no', label: '学号', type: 'text' as const },
  { key: 'class_name', label: '班级', type: 'text' as const },
  { key: 'company_email', label: '公司邮箱', type: 'email' as const },
  { key: 'phone', label: '手机号', type: 'text' as const },
  { key: 'member_no', label: '会员号', type: 'text' as const },
  { key: 'room_no', label: '房号', type: 'text' as const },
  { key: 'address', label: '地址', type: 'text' as const },
]

function SettingsPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { t } = useLingui()

  // ── Library settings ─────────────────────────────────────────
  const { data: lib, isLoading } = useQuery(api.library.settings.queryOptions())
  const [form, setForm] = useState<null | {
    name: string; borrowingPeriodDays: string; maxBooksPerReader: string; allowExtensions: boolean
  }>(null)
  const [saved, setSaved] = useState(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const current = form ?? (lib ? {
    name: lib.name,
    borrowingPeriodDays: String(lib.settings.borrowingPeriodDays),
    maxBooksPerReader: String(lib.settings.maxBooksPerReader),
    allowExtensions: lib.settings.allowExtensions,
  } : null)

  function set<K extends string>(field: K, value: string | boolean) {
    if (!current) return
    setForm({ ...current, [field]: value })
    setSaved(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!current) return
    setSettingsError(null); setSaved(false); setPending(true)
    try {
      await api.library.updateSettings.mutate({
        name: current.name.trim(),
        borrowingPeriodDays: Number(current.borrowingPeriodDays),
        maxBooksPerReader: Number(current.maxBooksPerReader),
        allowExtensions: current.allowExtensions,
      })
      await queryClient.invalidateQueries({ queryKey: api.library.settings.queryKey() })
      setSaved(true)
      toast.success(t`Settings saved.`)
    } catch {
      setSettingsError(t`Could not save settings. Check the values and try again.`)
    } finally {
      setPending(false)
    }
  }

  // ── Join form fields ─────────────────────────────────────────
  const { data: fields = [] } = useQuery(api.join.adminFields.queryOptions())
  const invalidateFields = () => queryClient.invalidateQueries({ queryKey: ['join', 'adminFields'] })

  const [fieldOpen, setFieldOpen] = useState(false)
  const [fKey, setFKey] = useState('')
  const [fLabel, setFLabel] = useState('')
  const [fType, setFType] = useState<'text' | 'email' | 'select'>('text')
  const [fRequired, setFRequired] = useState(true)
  const [fVerify, setFVerify] = useState(false)

  const addField = useMutation({
    ...api.join.addField.mutationOptions(),
    onSuccess: () => {
      toast.success(t`Field added.`)
      setFKey(''); setFLabel(''); setFType('text'); setFRequired(true); setFVerify(false)
      setFieldOpen(false); invalidateFields()
    },
  })
  const removeField = useMutation({
    ...api.join.removeField.mutationOptions(),
    onSuccess: () => { toast.success(t`Field removed.`); invalidateFields() },
  })

  if (isLoading || !current)
    return <p className="text-muted-foreground"><Trans>Loading…</Trans></p>

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold"><Trans>Settings</Trans></h1>

      {/* ── Library settings ── */}
      <Card>
        <CardHeader>
          <CardTitle><Trans>Library</Trans></CardTitle>
          <CardDescription>
            <Trans>Email domains: {lib?.emailDomains.join(', ') ?? ''}</Trans>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="settings-form">
            <div className="space-y-2">
              <Label htmlFor="name"><Trans>Library name</Trans></Label>
              <Input id="name" value={current.name} onChange={(e) => set('name', e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="borrowingPeriodDays"><Trans>Borrowing period (days)</Trans></Label>
              <Input id="borrowingPeriodDays" type="number" min={1} max={365}
                value={current.borrowingPeriodDays} onChange={(e) => set('borrowingPeriodDays', e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxBooksPerReader"><Trans>Max books per reader</Trans></Label>
              <Input id="maxBooksPerReader" type="number" min={1} max={100}
                value={current.maxBooksPerReader} onChange={(e) => set('maxBooksPerReader', e.target.value)} required />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={current.allowExtensions}
                onChange={(e) => set('allowExtensions', e.target.checked)} />
              <Trans>Allow renewals/extensions</Trans>
            </label>
            {settingsError && <p className="text-sm text-destructive">{settingsError}</p>}
            {saved && <p className="text-sm text-green-600" data-testid="settings-saved"><Trans>Settings saved.</Trans></p>}
            <Button type="submit" disabled={pending}>
              {pending ? <Trans>Saving…</Trans> : <Trans>Save settings</Trans>}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ── Join form fields ── */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle><Trans>Join form</Trans></CardTitle>
              <CardDescription>
                <Trans>Extra fields applicants fill before requesting to join.</Trans>
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setFieldOpen(true)} data-testid="join-form-add-open">
              <Trans>Add field</Trans>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {fields.length === 0 ? (
            <EmptyState icon="📋" title={<Trans>No custom fields</Trans>}
              description={<Trans>Anyone can request to join without filling extra info.</Trans>} />
          ) : (
            <div className="space-y-2">
              {fields.map((f) => (
                <div key={f.id} className="flex items-center gap-2 rounded-md border px-3 py-2"
                  data-testid={`join-field-${f.id}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{f.label}</p>
                    <p className="text-xs text-muted-foreground">{f.key}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0">{f.type}</Badge>
                  {f.required && <Badge variant="secondary" className="shrink-0"><Trans>Required</Trans></Badge>}
                  {f.verifyEmail && <Badge className="shrink-0"><Trans>Verify email</Trans></Badge>}
                  <Button size="sm" variant="ghost" onClick={() => removeField.mutate({ id: f.id })}
                    data-testid={`join-field-remove-${f.id}`}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Add field dialog ── */}
      <Modal open={fieldOpen} onClose={() => setFieldOpen(false)}
        ariaLabel={t`Add join form field`} data-testid="join-field-dialog"
        title={<Trans>Add a field</Trans>}
        description={<Trans>Applicants must fill this field before submitting a request.</Trans>}
        footer={
          <>
            <Button variant="outline" onClick={() => setFieldOpen(false)}><Trans>Cancel</Trans></Button>
            <Button type="submit" form="join-field-form" disabled={addField.isPending}>
              {addField.isPending ? <Trans>Adding…</Trans> : <Trans>Add field</Trans>}
            </Button>
          </>
        }>
        <form id="join-field-form" className="space-y-4"
          onSubmit={(e) => { e.preventDefault(); addField.mutate({ key: fKey.trim(), label: fLabel.trim(), type: fType, required: fRequired, verifyEmail: fVerify }) }}>
          {/* Presets: one-click fill from common 番薯 member fields */}
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground"><Trans>Common fields</Trans></p>
            <div className="flex flex-wrap gap-1.5">
              {FIELD_PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  className="rounded-md border bg-muted/60 px-2 py-1 text-xs hover:bg-muted"
                  onClick={() => { setFKey(p.key); setFLabel(p.label); setFType(p.type); setFVerify(p.type === 'email') }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="jf-key"><Trans>Field key</Trans></Label>
              <Input id="jf-key" value={fKey} onChange={(e) => setFKey(e.target.value)}
                placeholder="employee_id" required data-testid="jf-key" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jf-label"><Trans>Display label</Trans></Label>
              <Input id="jf-label" value={fLabel} onChange={(e) => setFLabel(e.target.value)}
                placeholder="Employee ID" required data-testid="jf-label" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="jf-type"><Trans>Type</Trans></Label>
            <select id="jf-type"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={fType} onChange={(e) => setFType(e.target.value as typeof fType)}>
              {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={fRequired} onChange={(e) => setFRequired(e.target.checked)} data-testid="jf-required" />
              <Trans>Required</Trans>
            </label>
            {fType === 'email' && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={fVerify} onChange={(e) => setFVerify(e.target.checked)} data-testid="jf-verify" />
                <Trans>Verify email ownership</Trans>
              </label>
            )}
          </div>
        </form>
      </Modal>
    </div>
  )
}
