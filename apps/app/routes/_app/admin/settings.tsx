import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { trpc, trpcClient } from '@/lib/trpc'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/Toast'
import { useI18n } from '@/lib/i18n'

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
  const { t } = useI18n()

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
      toast.success(t('settings.savedToast'))
    } catch {
      setError(t('settings.error'))
    } finally {
      setPending(false)
    }
  }

  if (isLoading || !current) return <p className="text-muted-foreground">{t('settings.loading')}</p>

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-bold">{t('settings.title')}</h1>
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.configuration')}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t('settings.emailDomains', { domains: lib?.emailDomains.join(', ') ?? '' })}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="settings-form">
            <div className="space-y-2">
              <Label htmlFor="name">{t('settings.name')}</Label>
              <Input id="name" value={current.name} onChange={(e) => set('name', e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="borrowingPeriodDays">{t('settings.borrowingPeriod')}</Label>
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
              <Label htmlFor="maxBooksPerReader">{t('settings.maxBooks')}</Label>
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
              {t('settings.allowExtensions')}
            </label>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {saved && <p className="text-sm text-green-600" data-testid="settings-saved">{t('settings.savedInline')}</p>}
            <Button type="submit" disabled={pending}>
              {pending ? t('settings.saving') : t('settings.save')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
