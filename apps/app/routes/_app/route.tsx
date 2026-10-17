import { useState } from 'react'
import { createFileRoute, Link, Outlet, redirect, useRouter } from '@tanstack/react-router'
import { signOut } from '@/lib/auth-client'
import { trpcClient } from '@/lib/trpc'
import { Button } from '@/components/ui/button'
import { FeedbackButton } from '@/components/FeedbackButton'
import { useInstallPrompt } from '@/components/Pwa'
import { ThemeToggle } from '@/components/ThemeToggle'
import { setViewMode, useViewMode } from '@/lib/view-mode'

export const Route = createFileRoute('/_app')({
  // Server-validated auth: requireMe throws if unauthenticated.
  beforeLoad: async () => {
    try {
      const user = await trpcClient.auth.requireMe.query()
      return { user }
    } catch {
      throw redirect({ to: '/login' })
    }
  },
  component: AppLayout,
})

interface NavItem {
  to: string
  label: string
}

function AppLayout() {
  const { user } = Route.useRouteContext()
  const router = useRouter()
  const isSuperAdmin = user.role === 'super_admin'
  const isAdmin = user.role === 'library_admin' || user.role === 'super_admin'
  const storedView = useViewMode()
  // Normalize the stored view to one the current role is allowed to use.
  const viewMode = (() => {
    if (!isAdmin) return 'reader' as const
    if (storedView === 'system' && !isSuperAdmin) return 'admin' as const
    return storedView
  })()
  const inSystemView = isSuperAdmin && viewMode === 'system'
  const inAdminView = isAdmin && viewMode === 'admin'
  const { canInstall, install } = useInstallPrompt()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleLogout() {
    await signOut()
    await router.navigate({ to: '/login' })
  }

  const landingFor = (v: 'system' | 'admin' | 'reader') =>
    v === 'system' ? '/admin/tenants' : v === 'admin' ? '/books' : '/my-books'

  async function switchView(next: 'system' | 'admin' | 'reader') {
    setViewMode(next)
    setMenuOpen(false)
    await router.navigate({ to: landingFor(next) })
  }

  // Super admins cycle System → Admin → Reader; library admins toggle Admin ↔ Reader.
  const nextView: 'system' | 'admin' | 'reader' = inSystemView
    ? 'admin'
    : inAdminView
      ? 'reader'
      : isSuperAdmin
        ? 'system'
        : 'admin'

  const navItems: NavItem[] = inSystemView
    ? [{ to: '/admin/tenants', label: 'Tenants' }]
    : inAdminView
      ? [
          { to: '/books', label: 'Catalog' },
          { to: '/admin/overdue', label: 'Overdue' },
          { to: '/admin/settings', label: 'Settings' },
          { to: '/admin/feedback', label: 'Feedback' },
          { to: '/admin/import', label: 'Import' },
        ]
      : [
          { to: '/my-books', label: 'My Books' },
          { to: '/scan', label: 'Scan' },
          { to: '/books', label: 'Catalog' },
        ]

  const home = inSystemView ? '/admin/tenants' : inAdminView ? '/books' : '/my-books'
  const viewLabel = inSystemView ? 'System view' : inAdminView ? 'Admin view' : 'Reader view'
  const nextLabel = nextView === 'system' ? 'System' : nextView === 'admin' ? 'Admin' : 'Reader'

  const viewSwitcher = isAdmin ? (
    <Button
      size="sm"
      variant="outline"
      onClick={() => switchView(nextView)}
      data-testid="view-switch"
      title={`Switch to ${nextLabel} view`}
    >
      → {nextLabel} view
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
      <header className="border-b border-t-2 border-t-primary bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-2 p-4">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="px-2 sm:hidden"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              onClick={() => setMenuOpen((o) => !o)}
            >
              <span aria-hidden className="text-lg">
                {menuOpen ? '✕' : '☰'}
              </span>
            </Button>
            <Link to={home} className="font-semibold">
              OpenBookCorner
            </Link>
            <nav className="hidden items-center gap-1 text-sm sm:flex">{navLinks()}</nav>
          </div>

          <div className="flex items-center gap-2 text-sm">
            {isAdmin && (
              <span className="hidden rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary sm:inline">
                {viewLabel}
              </span>
            )}
            <span className="hidden sm:inline">{viewSwitcher}</span>
            <ThemeToggle />
            {canInstall && (
              <Button
                size="sm"
                variant="outline"
                onClick={install}
                data-testid="install-button"
                className="hidden sm:inline-flex"
              >
                Install app
              </Button>
            )}
            <span className="hidden text-muted-foreground sm:inline">{user.name}</span>
            <Button size="sm" variant="outline" onClick={handleLogout}>
              Sign out
            </Button>
          </div>
        </div>

        {menuOpen && (
          <nav
            id="mobile-nav"
            className="mx-auto flex max-w-4xl flex-col gap-1 border-t p-4 text-sm sm:hidden"
          >
            {navLinks(() => setMenuOpen(false))}
            {isAdmin && <div className="pt-2">{viewSwitcher}</div>}
            <span className="pt-2 text-muted-foreground">Signed in as {user.name}</span>
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
