import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { signIn } from '@/lib/auth-client'
import { queryClient } from '@/lib/query'
import { setViewMode } from '@/lib/view-mode'
import { useI18n } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LanguageToggle } from '@/components/LanguageToggle'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/login')({ component: LoginPage })

function LoginPage() {
  const router = useRouter()
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const demoAccounts = [
    { roleKey: 'login.role.superAdmin', email: 'super@demo.test', password: 'password123' },
    { roleKey: 'login.role.libraryAdmin', email: 'admin@demo.test', password: 'password123' },
    { roleKey: 'login.role.libraryReader', email: 'reader@demo.test', password: 'password123' },
  ] as const

  function fillDemo(demo: { email: string; password: string }) {
    setEmail(demo.email)
    setPassword(demo.password)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      const res = await signIn.email({ email, password })
      if (res.error) {
        setError(t('login.invalid'))
        return
      }
      // Clear any cached queries from a PREVIOUS session before routing. Without
      // this, the cached `auth.requireMe` (resolved via ensureQueryData with a
      // staleTime) would serve the prior user's identity to the new user — e.g.
      // a reader signing in right after an admin would be shown as that admin.
      queryClient.clear()
      // Route to the role's default view and reset the stored view mode so a
      // stale value from a previous session doesn't misroute.
      const role = (res.data?.user as { role?: string } | undefined)?.role
      if (role === 'super_admin') {
        setViewMode('system')
        await router.navigate({ to: '/admin/tenants' })
      } else if (role === 'library_admin') {
        setViewMode('admin')
        await router.navigate({ to: '/books' })
      } else {
        setViewMode('reader')
        await router.navigate({ to: '/my-books' })
      }
    } catch {
      setError(t('login.invalid'))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle>{t('login.title')}</CardTitle>
              <p className="text-sm text-muted-foreground">{t('login.subtitle')}</p>
            </div>
            <LanguageToggle />
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('login.email')}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('login.password')}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? t('login.signingIn') : t('login.signIn')}
            </Button>
          </form>

          <div className="mt-6 rounded-md border border-dashed p-4">
            <p className="text-xs font-medium text-muted-foreground">{t('login.demoHint')}</p>
            <div className="mt-3 space-y-2">
              {demoAccounts.map((demo) => (
                <button
                  key={demo.email}
                  type="button"
                  onClick={() => fillDemo(demo)}
                  className="flex w-full items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                >
                  <span className="font-medium">{t(demo.roleKey)}</span>
                  <span className="text-xs text-muted-foreground">
                    {demo.email} · {demo.password}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
