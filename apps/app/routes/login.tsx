import { useEffect, useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { signIn } from '@/lib/auth-client'
import { fetchBranding, type TenantBranding } from '@/lib/branding'
import { queryClient } from '@/lib/query'
import { setViewMode } from '@/lib/view-mode'
import { Trans, useLingui } from '@lingui/react/macro'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LanguageToggle } from '@/components/LanguageToggle'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/login')({ component: LoginPage })

/**
 * Login header. When `branding` is present (the request Host resolved to a
 * tenant subdomain), show the tenant's logo + name + welcome line. Otherwise
 * show the standard unbranded "Welcome back" header (apex / unknown host).
 *
 * Purely presentational — it selects WHICH branding to show, never what the
 * server authorizes.
 */
export function LoginHeader({ branding }: { branding: TenantBranding | null }) {
  if (branding) {
    return (
      <div className="min-w-0">
        {branding.logoUrl && (
          <img
            src={branding.logoUrl}
            alt={branding.name}
            className="mb-3 h-10 w-auto object-contain"
          />
        )}
        <CardTitle data-testid="branded-name">{branding.name}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {branding.loginWelcome ?? <Trans>Sign in to your library</Trans>}
        </p>
      </div>
    )
  }
  return (
    <div>
      <CardTitle>
        <Trans>Welcome back</Trans>
      </CardTitle>
      <p className="text-sm text-muted-foreground">
        <Trans>Sign in to your library</Trans>
      </p>
    </div>
  )
}

/** Demo accounts helper — only shown on the standard (unbranded) login. */
function DemoAccounts({ onFill }: { onFill: (demo: { email: string; password: string }) => void }) {
  const { t } = useLingui()
  const demoAccounts = [
    { role: t`Super Admin`, email: 'super@demo.test', password: 'password123' },
    { role: t`Library Admin`, email: 'admin@demo.test', password: 'password123' },
    { role: t`Library Reader`, email: 'reader@demo.test', password: 'password123' },
  ] as const
  return (
    <div className="mt-6 rounded-md border border-dashed p-4" data-testid="demo-accounts">
      <p className="text-xs font-medium text-muted-foreground">
        <Trans>Try a demo account — tap a role to fill it in</Trans>
      </p>
      <div className="mt-3 space-y-2">
        {demoAccounts.map((demo) => (
          <button
            key={demo.email}
            type="button"
            onClick={() => onFill(demo)}
            className="flex w-full items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
          >
            <span className="font-medium">{demo.role}</span>
            <span className="text-xs text-muted-foreground">
              {demo.email} · {demo.password}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function LoginPage() {
  const router = useRouter()
  const { t } = useLingui()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  // Tenant branding for THIS host, resolved pre-auth. `null` = apex/unknown host
  // → standard unbranded login (with demo accounts).
  const [branding, setBranding] = useState<TenantBranding | null>(null)

  useEffect(() => {
    let active = true
    void fetchBranding().then((b) => {
      if (active) setBranding(b)
    })
    return () => {
      active = false
    }
  }, [])

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
        setError(t`That email or password doesn’t match. Please try again.`)
        return
      }
      // Clear any cached queries from a PREVIOUS session before routing. Without
      // this, the cached `auth.requireMe` (resolved via ensureQueryData with a
      // staleTime) would serve the prior user's identity to the new user — e.g.
      // a reader signing in right after an admin would be shown as that admin.
      queryClient.clear()
      // Route to the role's default view and reset the stored view mode so a
      // stale value from a previous session doesn't misroute. Branding is
      // presentational only — it does NOT change this role-based routing.
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
      setError(t`That email or password doesn’t match. Please try again.`)
    } finally {
      setPending(false)
    }
  }

  // Accent the primary button with the tenant's brand color when present.
  const accentStyle = branding?.brandColor
    ? ({ backgroundColor: branding.brandColor } as React.CSSProperties)
    : undefined

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <LoginHeader branding={branding} />
            <LanguageToggle />
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email"><Trans>Email</Trans></Label>
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
              <Label htmlFor="password"><Trans>Password</Trans></Label>
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
            <Button type="submit" className="w-full" disabled={pending} style={accentStyle}>
              {pending ? <Trans>Signing in…</Trans> : <Trans>Sign in</Trans>}
            </Button>
          </form>

          {/* Demo accounts are hidden on a real tenant host (branded login). */}
          {!branding && <DemoAccounts onFill={fillDemo} />}
        </CardContent>
      </Card>
    </div>
  )
}
