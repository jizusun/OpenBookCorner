import { createFileRoute, Outlet, redirect, useRouter } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ShieldCheck, BookOpen } from 'lucide-react'
import { authClient, useSession } from '@/lib/auth-client'
import { impersonationState } from '@/lib/impersonation'
import { ensureRequireMe, api } from '@/lib/api'
import { queryClient } from '@/lib/query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ImpersonationBanner } from '@/components/ImpersonationBanner'
import { FeedbackButton } from '@/components/FeedbackButton'
import { useInstallPrompt } from '@/components/Pwa'
import { ThemeToggle } from '@/components/ThemeToggle'
import { LanguageToggle } from '@/components/LanguageToggle'
import { Trans, useLingui } from '@lingui/react/macro'
import { setReaderPreview, useReaderPreview } from '@/lib/view-mode'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { UserMenu } from '@/components/UserMenu'
import { AppSidebar } from './AppSidebar'

/** Shows the active library name + the user's role in a subtle badge. */
function CurrentLibraryBadge({ role }: { role: string }) {
  const { data: libs } = useQuery(api.membership.mine.queryOptions())
  const active = libs?.find((l) => l.active)
  if (!active) return null
  const isAdmin = role === 'library_admin'
  return (
    <div className="hidden items-center gap-1.5 sm:flex" data-testid="current-library-badge">
      <span className="max-w-[160px] truncate text-sm text-muted-foreground">{active.name}</span>
      <Badge variant={isAdmin ? 'default' : 'secondary'} className="h-5 gap-1 px-1.5 text-[10px]">
        {isAdmin ? (
          <><ShieldCheck className="size-3" /><Trans>Admin</Trans></>
        ) : (
          <><BookOpen className="size-3" /><Trans>Reader</Trans></>
        )}
      </Badge>
    </div>
  )
}

export const Route = createFileRoute('/_app')({
  // Server-validated auth: requireMe throws if unauthenticated.
  beforeLoad: async ({ location, search }) => {
    let user
    try {
      user = await ensureRequireMe()
    } catch {
      throw redirect({ to: '/login' })
    }
    // ADR 0009: a user with no active library must pick/create one first.
    const needsLibrary = user.role !== 'super_admin' && !user.activeLibraryId
    const onboarding =
      location.pathname.endsWith('/welcome') || location.pathname.endsWith('/discover')
    if (needsLibrary && !onboarding) {
      throw redirect({ to: '/welcome' })
    }
    return { user }
  },
  component: AppLayout,
})

function AppLayout() {
  const { user } = Route.useRouteContext()
  const router = useRouter()
  const { t } = useLingui()
  const isLibraryAdmin = user.role === 'library_admin'
  const readerPreview = useReaderPreview()
  const { canInstall, install } = useInstallPrompt()

  // Impersonation banner: Better Auth sets session.impersonatedBy on an
  // impersonation session. When present, show the persistent banner.
  const session = useSession()
  const impersonation = impersonationState(session.data?.session ?? null)

  async function handleExitImpersonation() {
    try {
      await authClient.admin.stopImpersonating()
    } finally {
      queryClient.clear()
      await router.navigate({ to: '/admin/overview' })
    }
  }

  async function handleLogout() {
    // Better Auth's sign-out endpoint requires a JSON body; the client can send
    // an empty body which the server rejects with 400 "Invalid JSON" (login then
    // appears stuck). POST an explicit `{}` so the session is actually cleared.
    // Wrap in try/finally so the user is always returned to /login even if the
    // network call fails.
    try {
      await fetch('/api/auth/sign-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: '{}',
      })
    } finally {
      queryClient.clear()
      await router.navigate({ to: '/login' })
    }
  }

  // Library-admin-only "Reader preview": browse as a member (not a view switch).
  async function toggleReaderPreview() {
    const next = !readerPreview
    setReaderPreview(next)
    await router.navigate({ to: next ? '/my-books' : '/books' })
  }

  return (
    <>
      <ImpersonationBanner
        active={impersonation.active}
        viewingAs={user.name}
        onExit={handleExitImpersonation}
      />
      <SidebarProvider>
        <AppSidebar role={user.role} readerPreview={readerPreview} />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger data-testid="sidebar-toggle" />
            {/* Current library + role indicator — always visible so the user
                knows which library they're in and what they can do. */}
            {user.role !== 'super_admin' && (
              <CurrentLibraryBadge role={user.role} />
            )}
            <div className="ml-auto flex items-center gap-2">
              {isLibraryAdmin && (
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
              )}
              <LanguageToggle />
              <ThemeToggle />
              <UserMenu
                userName={user.name}
                onLogout={handleLogout}
                canInstall={canInstall}
                onInstall={install}
              />
            </div>
          </header>
          <div className="mx-auto w-full max-w-5xl flex-1 p-4">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
      <FeedbackButton />
    </>
  )
}
