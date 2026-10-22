import { useEffect, useState } from 'react'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { signIn } from '@/lib/auth-client'
import { fetchBranding, type TenantBranding } from '@/lib/branding'
import { fetchConfig, isDemoVisible } from '@/lib/config'
import { queryClient } from '@/lib/query'
import { setReaderPreview } from '@/lib/view-mode'
import { Trans, useLingui } from '@lingui/react/macro'
import { Loader2, LogIn } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/password-input'
import { LanguageToggle } from '@/components/LanguageToggle'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'


export const Route = createFileRoute('/login')({
  validateSearch: z.object({ redirect: z.string().optional() }),
  component: () => <LoginPage />,
})

const DEMO_PASSWORD = 'password123'

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

export function LoginHeader({ branding }: { branding: TenantBranding | null }) {
  if (branding) {
    return (
      <div className="min-w-0">
        {branding.logoUrl && (
          <img src={branding.logoUrl} alt={branding.name} className="mb-3 h-10 w-auto object-contain" />
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
      <CardTitle><Trans>Welcome back</Trans></CardTitle>
      <p className="text-sm text-muted-foreground"><Trans>Sign in to your library</Trans></p>
    </div>
  )
}

const loginSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email.' }),
  password: z.string().min(1, 'Please enter your password.'),
})
type LoginValues = z.infer<typeof loginSchema>

/**
 * Login form matching shadcn-admin's UserAuthForm:
 * react-hook-form + zod (FormMessage under each field), PasswordInput
 * (Eye/EyeOff toggle), Loader2 + LogIn icon on submit button.
 */
export function LoginPage({ slug }: { slug?: string } = {}) {
  const router = useRouter()
  // Read redirect from URL search params directly — Route.useSearch() only works
  // when rendered from /login; this component is also used from /t/:slug/login.
  const redirect = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('redirect') ?? undefined
    : undefined
  const { t } = useLingui()
  const [branding, setBranding] = useState<TenantBranding | null>(null)
  const [demoVisible, setDemoVisible] = useState(false)

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  useEffect(() => {
    let active = true
    void fetchBranding(slug).then((b) => { if (active) setBranding(b) })
    void fetchConfig().then((cfg) => { if (active) setDemoVisible(isDemoVisible(cfg)) })
    return () => { active = false }
  }, [slug])

  function fillDemo(demoEmail: string, demoPassword: string) {
    form.setValue('email', demoEmail)
    form.setValue('password', demoPassword)
    form.clearErrors()
  }

  async function onSubmit(data: LoginValues) {
    try {
      const res = await signIn.email({ email: data.email, password: data.password })
      if (res.error) {
        form.setError('email', { message: t`That email or password doesn't match. Please try again.` })
        return
      }
      // Clear cached queries from a previous session before routing.
      queryClient.clear()
      setReaderPreview(false)
      const role = (res.data?.user as { role?: string } | undefined)?.role
      // If there's a redirect param (e.g. from an invite link), go there first.
      if (redirect) {
        await router.navigate({ to: redirect as '/' })
        return
      }
      if (role === 'super_admin') await router.navigate({ to: '/admin/overview' })
      else if (role === 'library_admin') await router.navigate({ to: '/books' })
      else await router.navigate({ to: '/my-books' })
    } catch {
      form.setError('email', { message: t`That email or password doesn't match. Please try again.` })
    }
  }

  const isLoading = form.formState.isSubmitting
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
          <p className="text-sm text-muted-foreground">
            <Trans>
              Enter your email and password to sign in.{' '}
              Don't have an account?{' '}
              <Link to="/signup" className="underline underline-offset-4 hover:text-primary">
                Sign up
              </Link>
            </Trans>
          </p>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} method="post" className="grid gap-3">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel><Trans>Email</Trans></FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="name@example.com"
                        autoComplete="username"
                        data-testid="email-input"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel><Trans>Password</Trans></FormLabel>
                    <FormControl>
                      <PasswordInput
                        placeholder="••••••••"
                        autoComplete="current-password"
                        data-testid="password-input"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                className="mt-2 w-full"
                disabled={isLoading}
                style={accentStyle}
                data-testid="signin-submit"
              >
                {isLoading ? <Loader2 className="animate-spin" /> : <LogIn className="size-4" />}
                <Trans>Sign in</Trans>
              </Button>
            </form>
          </Form>

          {/* Click-to-fill demo accounts — ONLY in non-production. */}
          {demoVisible && <DemoAccounts slug={slug} onFill={fillDemo} />}
        </CardContent>
      </Card>
    </div>
  )
}
