import { useState } from 'react'
import { createFileRoute, Link, Outlet, redirect, useRouter } from '@tanstack/react-router'
import { signOut } from '@/lib/auth-client'
import { ensureRequireMe } from '@/lib/trpc'
import { queryClient } from '@/lib/query'
import { Button } from '@/components/ui/button'
import { FeedbackButton } from '@/components/FeedbackButton'
import { useInstallPrompt } from '@/components/Pwa'
import { ThemeToggle } from '@/components/ThemeToggle'
import { LanguageToggle } from '@/components/LanguageToggle'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { setViewMode, useViewMode } from '@/lib/view-mode'

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
  labelKey: MessageKey
}

function AppLayout() {
  const { user } = Route.useRouteContext()
  const router = useRouter()
  const { t } = useI18n()
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
    // Drop all cached queries so the next user can't inherit this session's
    // cached identity (e.g. requireMe).
    queryClient.clear()
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
    ? [{ to: '/admin/tenants', labelKey: 'nav.tenants' }]
    : inAdminView
      ? [
          { to: '/books', labelKey: 'nav.catalog' },
          { to: '/admin/members', labelKey: 'nav.members' },
          { to: '/admin/overdue', labelKey: 'nav.overdue' },
          { to: '/admin/settings', labelKey: 'nav.settings' },
          { to: '/admin/feedback', labelKey: 'nav.feedback' },
          { to: '/admin/import', labelKey: 'nav.import' },
        ]
      : [
          { to: '/my-books', labelKey: 'nav.myBooks' },
          { to: '/scan', labelKey: 'nav.scan' },
          { to: '/books', labelKey: 'nav.catalog' },
        ]

  const home = inSystemView ? '/admin/tenants' : inAdminView ? '/books' : '/my-books'
  const viewLabel = inSystemView
    ? t('view.system')
    : inAdminView
      ? t('view.admin')
      : t('view.reader')
  const nextLabelText =
    nextView === 'system' ? t('view.system') : nextView === 'admin' ? t('view.admin') : t('view.reader')
  const nextSwitchLabel =
    nextView === 'system' ? t('view.toSystem') : nextView === 'admin' ? t('view.toAdmin') : t('view.toReader')

  const viewSwitcher = isAdmin ? (
    <Button
      size="sm"
      variant="outline"
      onClick={() => switchView(nextView)}
      data-testid="view-switch"
      title={t('view.switchTo', { view: nextLabelText })}
    >
      {nextSwitchLabel}
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
        {t(item.labelKey)}
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
              aria-label={menuOpen ? t('common.closeMenu') : t('common.openMenu')}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              onClick={() => setMenuOpen((o) => !o)}
            >
              <span aria-hidden className="text-lg">
                {menuOpen ? '✕' : '☰'}
              </span>
            </Button>
            <Link to={home} className="font-semibold">
              {t('common.appName')}
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
                {t('common.installApp')}
              </Button>
            )}
            <span className="hidden text-muted-foreground sm:inline">{user.name}</span>
            <Button size="sm" variant="outline" onClick={handleLogout}>
              {t('common.signOut')}
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
            <span className="pt-2 text-muted-foreground">
              {t('common.signedInAs', { name: user.name })}
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
