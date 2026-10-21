import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useLingui } from '@lingui/react/macro'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { EmptyState } from '@/components/ui/empty-state'
import { ListPageSkeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/Toast'

export const Route = createFileRoute('/_app/discover')({
  pendingComponent: () => <ListPageSkeleton />,
  component: DiscoverPage,
})

// A simple inline join-form dialog that renders fields from a library's schema.
function JoinFormDialog({
  libraryId,
  libraryName,
  onClose,
}: {
  libraryId: string
  libraryName: string
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { t } = useLingui()
  const { data: fields = [], isLoading } = useQuery(
    api.join.fields.queryOptions({ libraryId }),
  )
  const [answers, setAnswers] = useState<Record<string, string>>({})

  const request = useMutation({
    ...api.join.request.mutationOptions(),
    onSuccess: () => {
      toast.success(t`Request submitted. The library admin will review it.`)
      queryClient.invalidateQueries({ queryKey: ['join', 'discover'] })
      onClose()
    },
    onError: (e: unknown) => {
      const err = e as { error?: string; fields?: Array<{ key: string; reason: string }> }
      if (err.error === 'VALIDATION_FAILED') {
        const msgs = err.fields?.map((f) => `${f.key}: ${f.reason}`).join(', ')
        toast.error(t`Please fill all required fields. ${msgs ?? ''}`)
      } else if (err.error === 'REQUEST_PENDING') {
        toast.error(t`You already have a pending request for this library.`)
      } else {
        toast.error(t`Could not submit request.`)
      }
    },
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    request.mutate({ libraryId, answers })
  }

  return (
    <Modal
      open
      onClose={onClose}
      ariaLabel={t`Request to join ${libraryName}`}
      data-testid={`join-form-${libraryId}`}
      title={<Trans>Request to join {libraryName}</Trans>}
      description={
        fields.length > 0
          ? <Trans>Please fill in the required information.</Trans>
          : <Trans>Send your request to the library admin for approval.</Trans>
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose}><Trans>Cancel</Trans></Button>
          <Button type="submit" form={`jf-${libraryId}`} disabled={request.isPending || isLoading}>
            {request.isPending ? <Trans>Submitting…</Trans> : <Trans>Submit request</Trans>}
          </Button>
        </>
      }
    >
      <form id={`jf-${libraryId}`} onSubmit={submit} className="space-y-4">
        {fields.map((f) => (
          <div key={f.id} className="space-y-2">
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
                <Trans>This email will need to be verified.</Trans>
              </p>
            )}
          </div>
        ))}
        {fields.length === 0 && !isLoading && (
          <p className="text-sm text-muted-foreground">
            <Trans>No extra information required.</Trans>
          </p>
        )}
      </form>
    </Modal>
  )
}

function DiscoverPage() {
  const router = useRouter()
  const { data: libs, isLoading } = useQuery(api.join.discover.queryOptions())
  const { data: mine } = useQuery(api.membership.mine.queryOptions())
  const [joining, setJoining] = useState<{ id: string; name: string } | null>(null)
  const hasLibrary = (mine ?? []).length > 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold"><Trans>Discover libraries</Trans></h1>
          <p className="text-sm text-muted-foreground">
            <Trans>Public libraries you can request to join.</Trans>
          </p>
        </div>
        <Button variant="outline" onClick={() => router.navigate({ to: hasLibrary ? '/books' : '/welcome' })}>
          <Trans>Back</Trans>
        </Button>
      </div>

      {isLoading && <ListPageSkeleton />}

      {!isLoading && (!libs || libs.length === 0) && (
        <EmptyState icon="🔎" title={<Trans>No public libraries found</Trans>}
          description={<Trans>No public libraries are available to join at the moment.</Trans>} />
      )}

      {!isLoading && libs && libs.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {libs.map((lib) => (
            <Card key={lib.id}>
              <CardHeader>
                <CardTitle className="text-base">{lib.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <Button size="sm" onClick={() => setJoining({ id: lib.id, name: lib.name })}
                  data-testid={`request-join-${lib.id}`}>
                  <Trans>Request to join</Trans>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {joining && (
        <JoinFormDialog
          libraryId={joining.id}
          libraryName={joining.name}
          onClose={() => setJoining(null)}
        />
      )}
    </div>
  )
}
