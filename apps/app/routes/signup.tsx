import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { Trans, useLingui } from '@lingui/react/macro'
import { Loader2, UserPlus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { signUp } from '@/lib/auth-client'
import { queryClient } from '@/lib/query'
import { setReaderPreview } from '@/lib/view-mode'
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

export const Route = createFileRoute('/signup')({ component: SignUpPage })

const formSchema = z
  .object({
    email: z.string().email({ message: 'Please enter a valid email.' }),
    password: z
      .string()
      .min(1, 'Please enter your password.')
      .min(7, 'Password must be at least 7 characters long.'),
    confirmPassword: z.string().min(1, 'Please confirm your password.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match.",
    path: ['confirmPassword'],
  })

type FormValues = z.infer<typeof formSchema>

function SignUpPage() {
  const router = useRouter()
  const { t } = useLingui()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
  })

  const isLoading = form.formState.isSubmitting

  async function onSubmit(data: FormValues) {
    try {
      await signUp.email({ email: data.email, password: data.password, name: data.email.split('@')[0]! })
      queryClient.clear()
      setReaderPreview(false)
      // New user has no active library → welcome screen (ADR 0009).
      await router.navigate({ to: '/welcome' })
    } catch {
      form.setError('email', { message: t`Could not create account. That email may already be registered.` })
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-lg tracking-tight">
              <Trans>Create an account</Trans>
            </CardTitle>
            <LanguageToggle />
          </div>
          <p className="text-sm text-muted-foreground">
            <Trans>
              Enter your email and password to create an account.{' '}
              Already have an account?{' '}
              <Link to="/login" className="underline underline-offset-4 hover:text-primary">
                Sign in
              </Link>
            </Trans>
          </p>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel><Trans>Email</Trans></FormLabel>
                    <FormControl>
                      <Input
                        placeholder="name@example.com"
                        autoComplete="email"
                        data-testid="signup-email"
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
                        autoComplete="new-password"
                        data-testid="signup-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel><Trans>Confirm password</Trans></FormLabel>
                    <FormControl>
                      <PasswordInput
                        placeholder="••••••••"
                        autoComplete="new-password"
                        data-testid="signup-confirm"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button className="mt-2 w-full" disabled={isLoading} data-testid="signup-submit">
                {isLoading ? <Loader2 className="animate-spin" /> : <UserPlus className="size-4" />}
                <Trans>Create account</Trans>
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
