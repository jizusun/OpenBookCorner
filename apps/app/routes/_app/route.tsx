import { useState } from 'react'
import { createFileRoute, Link, Outlet, redirect, useRouter } from '@tanstack/react-router'
import { authClient, signOut, useSession } from '@/lib/auth-client'
import { impersonationState } from '@/lib/impersonation'
import { ensureRequireMe } from '@/lib/api'
import { queryClient } from '@/lib/query'
import { Button } from '@/components/ui/button'
import { ImpersonationBanner } from '@/components/ImpersonationBanner'
import { FeedbackButton } from '@/components/FeedbackButton'
import { useInstallPrompt } from '@/components/Pwa'
import { ThemeToggle } from '@/components/ThemeToggle'
import { LanguageToggle } from '@/components/LanguageToggle'
import { Trans, useLingui } from '@lingui/react/macro'
import { setReaderPreview, useReaderPreview } from '@/lib/view-mode'

export const Route = createFileRoute('/_app')({
  // Server-validated auth: requireMe throws if unauthenticated.
  beforeLoad: async () => {
    try {
      const user = await ensureRequireMe()
      return { user }
    } catch {
      throw redirect({ to: '/login' })
    }
  },
  component: AppLayout,
})

interface NavItem {
  to: string
  label: React.ReactNode
}

function AppLayout() {
  const { user } = Route.useRouteContext()
  const router = useRouter()
  const { t } = useLingui()
  const isSuperAdmin = user.role === 'super_admin'
  const isLibraryAdmin = user.role === 'library_admin'
  const readerPreview = useReaderPreview()

  // The surface is determined by ROLE (no three-state view switch). A library
  // admin may optionally flip a secondary "Reader preview" to browse as a member;
  // super admins use the system console and impersonation (not a view switch).
  const surface: 'system' | 'admin' | 'reader' = isSuperAdmin
    ? 'system'
    : isLibraryAdmin && !readerPreview
      ? 'admin'
      : 'reader'
  const inSystemView = surface === 'system'
  const inAdminView = surface === 'admin'
  const { canInstall, install } = useInstallPrompt()
  const [menuOpen, setMenuOpen] = useState(false)

  // Impersonation banner state: Better Auth sets session.impersonatedBy on an
  // impersonation session. When present, show the persistent banner; the current
  // user object (the impersonated user) supplies the display name.
  const session = useSession()
  const impersonation = impersonationState(session.data?.session ?? null)

  async function handleExitImpersonation() {
    try {
      await authClient.admin.stopImpersonating()
    } finally {
      // Restore the admin's own identity: drop cached queries + go to the
      // super-admin landing.
      queryClient.clear()
      await router.navigate({ to: '/admin/overview' })
    }
  }

  async function handleLogout() {
    await signOut()
    // Drop all cached queries so the next user can't inherit this session's
    // cached identity (e.g. requireMe).
    queryClient.clear()
    await router.navigate({ to: '/login' })
  }

  // Library-admin-only "Reader preview" toggle (not a role/scope switch). Flips
  // the admin between the admin surface and a member's-eye reader surface.
  async function toggleReaderPreview() {
    const next = !readerPreview
    setReaderPreview(next)
    setMenuOpen(false)
    await router.navigate({ to: next ? '/my-books' : '/books' })
  }

  const navItems: NavItem[] = inSystemView
    ? [
        { to: '/admin/overview', label: <Trans>Overview</Trans> },
        { to: '/admin/tenants', label: <Trans>Tenants</Trans> },
        { to: '/admin/users', label: <Trans>Users</Trans> },
        { to: '/admin/books', label: <Trans>Books</Trans> },
        { to: '/admin/audit', label: <Trans>Audit log</Trans> },
        { to: '/admin/system', label: <Trans>System settings</Trans> },
      ]
    : inAdminView
      ? [
          { to: '/books', label: <Trans>Catalog</Trans> },
          { to: '/admin/members', label: <Trans>Readers</Trans> },
          { to: '/admin/overdue', label: <Trans>Overdue</Trans> },
          { to: '/admin/settings', label: <Trans>Settings</Trans> },
          { to: '/admin/feedback', label: <Trans>Feedback</Trans> },
          { to: '/admin/import', label: <Trans>Import</Trans> },
        ]
      : [
          { to: '/my-books', label: <Trans>My Books</Trans> },
          { to: '/scan', label: <Trans>Scan</Trans> },
          { to: '/books', label: <Trans>Catalog</Trans> },
        ]

  const home = inSystemView ? '/admin/overview' : inAdminView ? '/books' : '/my-books'

  // A library admin (only) gets a secondary Reader-preview toggle. Readers have
  // no surface controls; super admins switch context via impersonation.
  const readerPreviewToggle = isLibraryAdmin ? (
    <Button
      size="sm"
      variant="outline"
      onClick={toggleReaderPreview}
      data-testid="reader-preview-toggle"
      aria-pressed={readerPreview}
      title={readerPreview ? t`Exit reader preview` : t`Preview as a reader`}
    >
      {readerPreview ? <Trans>Exit reader preview</Trans> : <Trans>Reader preview</Trans>}
    </Button>
  ) : null

  const navLinks = (onNavigate?: () => void) =>
    navItems.map((item) => (
      <Link
        key={item.to}
        to={item.to}
        onClick={onNavigate}
        className="rounded-md px-2 py-1 hover:bg-accent"
        activeProps={{ className: 'rounded-md px-2 py-1 bg-accent font-semibold' }}
      >
        {item.label}
      </Link>
    ))

  return (
    <div className="min-h-screen bg-background">
      <ImpersonationBanner
        active={impersonation.active}
        viewingAs={user.name}
        onExit={handleExitImpersonation}
      />
      <header className="border-b border-t-2 border-t-primary bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-2 p-4">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="px-2 sm:hidden"
              aria-label={menuOpen ? t`Close menu` : t`Open menu`}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              onClick={() => setMenuOpen((o) => !o)}
            >
              <span aria-hidden className="text-lg">
                {menuOpen ? '✕' : '☰'}
              </span>
            </Button>
            <Link to={home} className="font-semibold">
              <Trans>OpenBookCorner</Trans>
            </Link>
            <nav className="hidden items-center gap-1 text-sm sm:flex">{navLinks()}</nav>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <span className="hidden sm:inline">{readerPreviewToggle}</span>
            <LanguageToggle />
            <ThemeToggle />
            {canInstall && (
              <Button
                size="sm"
                variant="outline"
                onClick={install}
                data-testid="install-button"
                className="hidden sm:inline-flex"
              >
                <Trans>Install app</Trans>
              </Button>
            )}
            <span className="hidden text-muted-foreground sm:inline">{user.name}</span>
            <Button size="sm" variant="outline" onClick={handleLogout}>
              <Trans>Sign out</Trans>
            </Button>
          </div>
        </div>

        {menuOpen && (
          <nav
            id="mobile-nav"
            className="mx-auto flex max-w-4xl flex-col gap-1 border-t p-4 text-sm sm:hidden"
          >
            {navLinks(() => setMenuOpen(false))}
            {readerPreviewToggle && <div className="pt-2">{readerPreviewToggle}</div>}
            <span className="pt-2 text-muted-foreground">
              <Trans>Signed in as {user.name}</Trans>
            </span>
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-4xl p-4">
        <Outlet />
      </main>
      <FeedbackButton />
    </div>
  )
}
