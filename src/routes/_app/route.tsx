import { createFileRoute, Link, Outlet, redirect, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { me, logout } from '@/server/functions/auth'
import { Button } from '@/components/ui/button'
import { FeedbackButton } from '@/components/FeedbackButton'

export const Route = createFileRoute('/_app')({
  // Server-validated auth: me() throws if unauthenticated; redirect to login.
  beforeLoad: async () => {
    try {
      return { user: await me() }
    } catch {
      throw redirect({ to: '/login' })
    }
  },
  component: AppLayout,
})

function AppLayout() {
  const { user } = Route.useRouteContext()
  const router = useRouter()
  const logoutFn = useServerFn(logout)
  const isAdmin = user.role === 'library_admin' || user.role === 'super_admin'

  async function handleLogout() {
    await logoutFn({ data: undefined })
    await router.navigate({ to: '/login' })
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-4xl items-center justify-between p-4">
          <nav className="flex items-center gap-4">
            <Link to="/books" className="font-semibold" activeProps={{ className: 'underline' }}>
              Catalog
            </Link>
            <Link to="/my-books" activeProps={{ className: 'underline' }}>
              My Books
            </Link>
            {isAdmin && (
              <Link to="/admin/overdue" activeProps={{ className: 'underline' }}>
                Overdue
              </Link>
            )}
            {isAdmin && (
              <Link to="/admin/settings" activeProps={{ className: 'underline' }}>
                Settings
              </Link>
            )}
            {isAdmin && (
              <Link to="/admin/feedback" activeProps={{ className: 'underline' }}>
                Feedback
              </Link>
            )}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">{user.name}</span>
            <Button size="sm" variant="outline" onClick={handleLogout}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl p-4">
        <Outlet />
      </main>
      <FeedbackButton />
    </div>
  )
}
