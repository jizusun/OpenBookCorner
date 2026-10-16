import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { getLibrarySettings, updateLibrarySettings } from '@/server/functions/library'
import { me } from '@/server/functions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/_app/admin/settings')({
  beforeLoad: async () => {
    const user = await me()
    if (user.role !== 'library_admin' && user.role !== 'super_admin') {
      throw redirect({ to: '/books' })
    }
  },
  component: SettingsPage,
})

function SettingsPage() {
  const queryClient = useQueryClient()
  const getFn = useServerFn(getLibrarySettings)
  const updateFn = useServerFn(updateLibrarySettings)

  const { data: lib, isLoading } = useQuery({
    queryKey: ['library-settings'],
    queryFn: () => getFn({ data: undefined }),
  })

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
      await updateFn({
        data: {
          name: current.name.trim(),
          borrowingPeriodDays: Number(current.borrowingPeriodDays),
          maxBooksPerReader: Number(current.maxBooksPerReader),
          allowExtensions: current.allowExtensions,
        },
      })
      await queryClient.invalidateQueries({ queryKey: ['library-settings'] })
      setSaved(true)
    } catch {
      setError('Could not save settings. Check the values and try again.')
    } finally {
      setPending(false)
    }
  }

  if (isLoading || !current) return <p className="text-muted-foreground">Loading…</p>

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-bold">Library Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <p className="text-sm text-muted-foreground">
            Email domains: {lib?.emailDomains.join(', ')}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="settings-form">
            <div className="space-y-2">
              <Label htmlFor="name">Library name</Label>
              <Input id="name" value={current.name} onChange={(e) => set('name', e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="borrowingPeriodDays">Borrowing period (days)</Label>
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
              <Label htmlFor="maxBooksPerReader">Max books per reader</Label>
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
              Allow renewals/extensions
            </label>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {saved && <p className="text-sm text-green-600" data-testid="settings-saved">Settings saved.</p>}
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Save settings'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
