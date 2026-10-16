import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { signIn } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/login')({ component: LoginPage })

function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const demoAccounts = [
    { role: 'Library Admin', email: 'admin@demo.test', password: 'password123' },
    { role: 'Library Reader', email: 'reader@demo.test', password: 'password123' },
  ]

  function fillDemo(demo: { email: string; password: string }) {
    setEmail(demo.email)
    setPassword(demo.password)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      const res = await signIn.email({ email, password })
      if (res.error) {
        setError('Invalid email or password')
        return
      }
      await router.navigate({ to: '/my-books' })
    } catch {
      setError('Invalid email or password')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Library Access</CardTitle>
          <p className="text-sm text-muted-foreground">Sign in to your library</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
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
              <Label htmlFor="password">Password</Label>
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
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-6 rounded-md border border-dashed p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Demo accounts — click a role to autofill
            </p>
            <div className="mt-3 space-y-2">
              {demoAccounts.map((demo) => (
                <button
                  key={demo.email}
                  type="button"
                  onClick={() => fillDemo(demo)}
                  className="flex w-full items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                >
                  <span className="font-medium">{demo.role}</span>
                  <span className="text-xs text-muted-foreground">
                    {demo.email} · {demo.password}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
