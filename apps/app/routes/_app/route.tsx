import { useState } from 'react'
import { createFileRoute, Link, Outlet, redirect, useRouter } from '@tanstack/react-router'
import { signOut } from '@/lib/auth-client'
import { trpcClient } from '@/lib/trpc'
import { Button } from '@/components/ui/button'
import { FeedbackButton } from '@/components/FeedbackButton'
import { useInstallPrompt } from '@/components/Pwa'
import { ThemeToggle } from '@/components/ThemeToggle'

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
  const isAdmin = user.role === 'library_admin' || user.role === 'super_admin'
  const { canInstall, install } = useInstallPrompt()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleLogout() {
    await signOut()
    await router.navigate({ to: '/login' })
  }

  const navItems: NavItem[] = [
    { to: '/my-books', label: 'My Books' },
    { to: '/scan', label: 'Scan' },
    { to: '/books', label: 'Catalog' },
    ...(isAdmin
      ? [
          { to: '/admin/overdue', label: 'Overdue' },
          { to: '/admin/settings', label: 'Settings' },
          { to: '/admin/feedback', label: 'Feedback' },
        ]
      : []),
  ]

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
      <header className="border-b">
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
            <Link to="/my-books" className="font-semibold">
              OpenBookCorner
            </Link>
            <nav className="hidden items-center gap-1 text-sm sm:flex">{navLinks()}</nav>
          </div>

          <div className="flex items-center gap-2 text-sm">
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
