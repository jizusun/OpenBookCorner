import { useState } from 'react'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { Trans, useLingui } from '@lingui/react/macro'
import { UserPlus } from 'lucide-react'
import { signUp } from '@/lib/auth-client'
import { queryClient } from '@/lib/query'
import { setReaderPreview } from '@/lib/view-mode'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LanguageToggle } from '@/components/LanguageToggle'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/signup')({ component: SignUpPage })

function SignUpPage() {
  const router = useRouter()
  const { t } = useLingui()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError(t`Passwords don't match.`)
      return
    }
    setError(null)
    setPending(true)
    try {
      await signUp.email({ email, password, name: name.trim() || email.split('@')[0]! })
      queryClient.clear()
      setReaderPreview(false)
      // New user has no active library → welcome screen (ADR 0009).
      await router.navigate({ to: '/welcome' })
    } catch {
      setError(t`Could not create account. That email may already be registered.`)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-lg tracking-tight">
                <Trans>Create an account</Trans>
              </CardTitle>
            </div>
            <LanguageToggle />
          </div>
          <p className="text-sm text-muted-foreground">
            <Trans>
              Enter your details to create an account.{' '}
              Already have an account?{' '}
              <Link to="/login" className="underline underline-offset-4 hover:text-primary">
                Sign in
              </Link>
            </Trans>
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="su-name"><Trans>Name</Trans></Label>
              <Input
                id="su-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t`Your name`}
                data-testid="signup-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="su-email"><Trans>Email</Trans></Label>
              <Input
                id="su-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="signup-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="su-password"><Trans>Password</Trans></Label>
              <Input
                id="su-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={7}
                data-testid="signup-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="su-confirm"><Trans>Confirm password</Trans></Label>
              <Input
                id="su-confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                data-testid="signup-confirm"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={pending} data-testid="signup-submit">
              {pending ? (
                <Trans>Creating…</Trans>
              ) : (
                <>
                  <UserPlus className="size-4" />
                  <Trans>Create account</Trans>
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
