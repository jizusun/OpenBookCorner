import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useLingui } from '@lingui/react/macro'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/ui/empty-state'

export const Route = createFileRoute('/join/$token')({
  component: JoinPage,
})

function JoinPage() {
  const { token } = Route.useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { t } = useLingui()

  // Resolve the invite token
  const { data: resolved, isLoading, isError } = useQuery({
    ...api.invite.resolve.queryOptions({ token }),
    retry: false,
  })

  // Current user (null if unauthenticated)
  const { data: me } = useQuery({
    ...api.auth.me.queryOptions(),
    retry: false,
  })

  // State (must be declared before queries that depend on them)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [alreadyMember, setAlreadyMember] = useState(false)

  // Check if the user is already a member of this library (proactive check)
  const { data: myLibraries = [] } = useQuery({
    ...api.membership.mine.queryOptions(),
    enabled: !!me,
  })
  const isAlreadyMember = alreadyMember ||
    (!!resolved && myLibraries.some((l) => l.libraryId === resolved.libraryId && l.active))

  // Library join form fields (only fetched when resolved + authenticated + not already member)
  const { data: fields = [] } = useQuery({
    ...api.join.fields.queryOptions({ libraryId: resolved?.libraryId ?? '' }),
    enabled: !!resolved && !!me && !isAlreadyMember,
  })

  const use = useMutation({
    ...api.invite.use.mutationOptions(),
    onSuccess: async (data) => {
      queryClient.clear()
      await router.invalidate()
      // Navigate to the joined library directly via /switch/<libraryId> which
      // auto-switches the active library then lands on /books.
      const result = data as unknown as { memberId?: string; requestId?: string }
      if (result.memberId) {
        await router.navigate({ to: '/switch/$libraryId', params: { libraryId: result.memberId } })
      } else {
        // Approval-required: request submitted, no immediate membership
        await router.navigate({ to: '/discover' })
      }
    },
    onError: (e: unknown) => {
      // The api.ts json() helper throws Error with message = body.error.
      const msg = (e as Error)?.message ?? ''
      if (msg === 'ALREADY_MEMBER') {
        setAlreadyMember(true)
        return
      }
      if (msg === 'VALIDATION_FAILED') {
        setFormError(t`Please fill all required fields.`)
      } else {
        setFormError(t`Could not join. Please try again.`)
      }
    },
  })

  function handleJoin() {
    setFormError(null)
    // Client-side required-field check before submitting
    const missing = fields.filter((f) => f.required && !(answers[f.key] ?? '').trim())
    if (missing.length > 0) {
      setFormError(t`Please fill in all required fields: ${missing.map((f) => f.label).join(', ')}`)
      return
    }
    use.mutate({ token, answers: Object.keys(answers).length > 0 ? answers : undefined })
  }

  if (isLoading) return (
    <div className="flex h-screen items-center justify-center">
      <p className="text-muted-foreground"><Trans>Loading…</Trans></p>
    </div>
  )

  if (isError || !resolved) return (
    <div className="flex h-screen items-center justify-center">
      <EmptyState icon="❌" title={<Trans>Invalid or expired invite</Trans>}
        description={<Trans>This invite link is no longer valid.</Trans>} />
    </div>
  )

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold">
            <Trans>You've been invited to join</Trans>
          </h1>
          <p className="text-xl font-medium text-primary">{resolved.libraryName}</p>
          <p className="text-sm text-muted-foreground">
            {resolved.requiresApproval
              ? <Trans>Your request will need approval from the library admin.</Trans>
              : <Trans>You'll be added immediately.</Trans>}
          </p>
        </div>

        {me ? (
          /* Authenticated */
          isAlreadyMember ? (
            /* Already a member — show friendly state instead of error */
            <div className="space-y-4 text-center">
              <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">
                  <Trans>You're already a member of {resolved.libraryName}</Trans>
                </p>
                <p className="mt-1">
                  <Trans>No need to join again.</Trans>
                </p>
              </div>
              <Button className="w-full" onClick={() => router.navigate({ to: '/switch/$libraryId', params: { libraryId: resolved.libraryId } })}>
                <Trans>Go to library</Trans>
              </Button>
            </div>
          ) : (
          /* Not yet a member: show join form fields if any, then the join button */
          <div className="space-y-4">
            {fields.length > 0 && (
              <div className="space-y-3 rounded-md border p-4">
                <p className="text-sm font-medium">
                  <Trans>Please fill in the required information to join.</Trans>
                </p>
                {fields.map((f) => (
                  <div key={f.id} className="space-y-1.5">
                    <Label htmlFor={`jf-${f.id}`}>
                      {f.label}
                      {f.required && <span className="ml-1 text-destructive">*</span>}
                    </Label>
                    <Input
                      id={`jf-${f.id}`}
                      type={f.type === 'email' ? 'email' : 'text'}
                      required={f.required ?? false}
                      value={answers[f.key] ?? ''}
                      onChange={(e) => setAnswers((p) => ({ ...p, [f.key]: e.target.value }))}
                      data-testid={`jf-answer-${f.key}`}
                    />
                    {f.verifyEmail && (
                      <p className="text-xs text-muted-foreground">
                        <Trans>This email will be verified.</Trans>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {formError && (
              <p className="text-sm text-destructive">{formError}</p>
            )}

            <Button className="w-full" onClick={handleJoin} disabled={use.isPending}
              data-testid="invite-join-btn">
              {use.isPending
                ? <Trans>Joining…</Trans>
                : resolved.requiresApproval
                  ? <Trans>Submit request</Trans>
                  : <Trans>Join library</Trans>}
            </Button>
          </div>
          ) /* end isAlreadyMember ternary */
        ) : (
          /* Unauthenticated: direct to login/signup with redirect */
          <div className="space-y-3">
            <p className="text-sm text-center text-muted-foreground">
              <Trans>You need to sign in or create an account first.</Trans>
            </p>
            <Button className="w-full"
              onClick={() => router.navigate({ to: '/login', search: { redirect: `/join/${token}` } })}
              data-testid="invite-signin-btn">
              <Trans>Sign in to join</Trans>
            </Button>
            <Button className="w-full" variant="outline"
              onClick={() => router.navigate({ to: '/signup', search: { redirect: `/join/${token}` } })}
              data-testid="invite-signup-btn">
              <Trans>Create account to join</Trans>
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
