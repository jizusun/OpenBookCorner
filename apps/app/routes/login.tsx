import { useEffect, useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { signIn } from '@/lib/auth-client'
import { fetchBranding, type TenantBranding } from '@/lib/branding'
import { fetchConfig, isDemoVisible } from '@/lib/config'
import { queryClient } from '@/lib/query'
import { setViewMode } from '@/lib/view-mode'
import { Trans, useLingui } from '@lingui/react/macro'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LanguageToggle } from '@/components/LanguageToggle'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/login')({ component: () => <LoginPage /> })

const DEMO_PASSWORD = 'password123'

/**
 * Demo accounts for the click-to-fill helper. NON-PRODUCTION only (gated by the
 * caller). Scoped by tenant slug: a tenant login page shows only that tenant's
 * two accounts; the apex login shows all (incl. super admin). Credentials match
 * the seed (db/scripts/seed-users.sh).
 */
interface DemoUser {
  label: string
  email: string
}
const DEMO_BY_SLUG: Record<string, DemoUser[]> = {
  acme: [
    { label: 'Acme Admin', email: 'admin@demo.test' },
    { label: 'Acme Reader', email: 'reader@demo.test' },
  ],
  globex: [
    { label: 'Globex Admin', email: 'admin@globex.test' },
    { label: 'Globex Reader', email: 'reader@globex.test' },
  ],
}
const SUPER_DEMO: DemoUser = { label: 'Super Admin', email: 'super@demo.test' }

function demoUsersFor(slug: string | undefined): DemoUser[] {
  if (slug) return DEMO_BY_SLUG[slug] ?? []
  // Apex: all tenants' accounts + the super admin.
  return [SUPER_DEMO, ...DEMO_BY_SLUG.acme!, ...DEMO_BY_SLUG.globex!]
}

function DemoAccounts({
  slug,
  onFill,
}: {
  slug: string | undefined
  onFill: (email: string, password: string) => void
}) {
  const users = demoUsersFor(slug)
  if (users.length === 0) return null
  return (
    <div className="mt-6 rounded-md border border-dashed p-4" data-testid="demo-accounts">
      <p className="text-xs font-medium text-muted-foreground">
        <Trans>Demo accounts (non-production) — tap to fill in</Trans>
      </p>
      <div className="mt-3 space-y-2">
        {users.map((u) => (
          <button
            key={u.email}
            type="button"
            onClick={() => onFill(u.email, DEMO_PASSWORD)}
            className="flex w-full items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
          >
            <span className="font-medium">{u.label}</span>
            <span className="text-xs text-muted-foreground">
              {u.email} · {DEMO_PASSWORD}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

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
export function LoginPage({ slug }: { slug?: string } = {}) {
  const router = useRouter()
  const { t } = useLingui()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  // Tenant branding for THIS host, resolved pre-auth. `null` = apex/unknown host
  // → standard unbranded login (with demo accounts).
  const [branding, setBranding] = useState<TenantBranding | null>(null)
  // Whether to show the click-to-fill demo accounts (NON-PRODUCTION only; fails
  // closed to hidden if the config can't be resolved).
  const [demoVisible, setDemoVisible] = useState(false)

  useEffect(() => {
    let active = true
    void fetchBranding(slug).then((b) => {
      if (active) setBranding(b)
    })
    void fetchConfig().then((cfg) => {
      if (active) setDemoVisible(isDemoVisible(cfg))
    })
    return () => {
      active = false
    }
  }, [slug])

  function fillDemo(demoEmail: string, demoPassword: string) {
    setEmail(demoEmail)
    setPassword(demoPassword)
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
        await router.navigate({ to: '/admin/overview' })
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

          {/* Click-to-fill demo accounts — ONLY in non-production. Apex shows
              all (incl. super admin); a tenant page shows only that tenant's. */}
          {demoVisible && <DemoAccounts slug={slug} onFill={fillDemo} />}
        </CardContent>
      </Card>
    </div>
  )
}
