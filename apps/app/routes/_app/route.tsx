import { createFileRoute, Outlet, redirect, useRouter } from '@tanstack/react-router'
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
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from './AppSidebar'

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
    await signOut()
    queryClient.clear()
    await router.navigate({ to: '/login' })
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
        <AppSidebar
          role={user.role}
          readerPreview={readerPreview}
          userName={user.name}
          onLogout={handleLogout}
          canInstall={canInstall}
          onInstall={install}
        />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger data-testid="sidebar-toggle" />
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
            </div>
          </header>
          <main className="mx-auto w-full max-w-5xl flex-1 p-4">
            <Outlet />
          </main>
        </SidebarInset>
      </SidebarProvider>
      <FeedbackButton />
    </>
  )
}
