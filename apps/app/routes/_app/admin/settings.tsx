import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useLingui } from '@lingui/react/macro'
import { trpc, trpcClient } from '@/lib/trpc'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/Toast'

export const Route = createFileRoute('/_app/admin/settings')({
  beforeLoad: ({ context }) => {
    const user = context.user
    if (user.role !== 'library_admin' && user.role !== 'super_admin') {
      throw redirect({ to: '/books' })
    }
  },
  component: SettingsPage,
})

function SettingsPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { t } = useLingui()

  const { data: lib, isLoading } = useQuery(trpc.library.settings.queryOptions())

  const [form, setForm] = useState<null | {
    name: string
    borrowingPeriodDays: string
    maxBooksPerReader: string
    allowExtensions: boolean
  }>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const current =
    form ??
    (lib
      ? {
          name: lib.name,
          borrowingPeriodDays: String(lib.settings.borrowingPeriodDays),
          maxBooksPerReader: String(lib.settings.maxBooksPerReader),
          allowExtensions: lib.settings.allowExtensions,
        }
      : null)

  function set<K extends string>(field: K, value: string | boolean) {
    if (!current) return
    setForm({ ...current, [field]: value })
    setSaved(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!current) return
    setError(null)
    setSaved(false)
    setPending(true)
    try {
      await trpcClient.library.updateSettings.mutate({
        name: current.name.trim(),
        borrowingPeriodDays: Number(current.borrowingPeriodDays),
        maxBooksPerReader: Number(current.maxBooksPerReader),
        allowExtensions: current.allowExtensions,
      })
      await queryClient.invalidateQueries({ queryKey: trpc.library.settings.queryKey() })
      setSaved(true)
      toast.success(t`Settings saved.`)
    } catch {
      setError(t`Could not save settings. Check the values and try again.`)
    } finally {
      setPending(false)
    }
  }

  if (isLoading || !current)
    return (
      <p className="text-muted-foreground">
        <Trans>Loading…</Trans>
      </p>
    )

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-bold">
        <Trans>Library Settings</Trans>
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>
            <Trans>Configuration</Trans>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            <Trans>Email domains: {lib?.emailDomains.join(', ') ?? ''}</Trans>
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="settings-form">
            <div className="space-y-2">
              <Label htmlFor="name">
                <Trans>Library name</Trans>
              </Label>
              <Input id="name" value={current.name} onChange={(e) => set('name', e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="borrowingPeriodDays">
                <Trans>Borrowing period (days)</Trans>
              </Label>
              <Input
                id="borrowingPeriodDays"
                type="number"
                min={1}
                max={365}
                value={current.borrowingPeriodDays}
                onChange={(e) => set('borrowingPeriodDays', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxBooksPerReader">
                <Trans>Max books per reader</Trans>
              </Label>
              <Input
                id="maxBooksPerReader"
                type="number"
                min={1}
                max={100}
                value={current.maxBooksPerReader}
                onChange={(e) => set('maxBooksPerReader', e.target.value)}
                required
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={current.allowExtensions}
                onChange={(e) => set('allowExtensions', e.target.checked)}
              />
              <Trans>Allow renewals/extensions</Trans>
            </label>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {saved && (
              <p className="text-sm text-green-600" data-testid="settings-saved">
                <Trans>Settings saved.</Trans>
              </p>
            )}
            <Button type="submit" disabled={pending}>
              {pending ? <Trans>Saving…</Trans> : <Trans>Save settings</Trans>}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
