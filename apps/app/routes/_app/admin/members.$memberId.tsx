import { createFileRoute, redirect, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Trans, useLingui } from '@lingui/react/macro'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export const Route = createFileRoute('/_app/admin/members/$memberId')({
  beforeLoad: ({ context }) => {
    if (context.user.role !== 'library_admin' && context.user.role !== 'super_admin') {
      throw redirect({ to: '/books' })
    }
  },
  component: MemberDetailPage,
})

function Row({ label, value }: { label: string; value: unknown }) {
  if (value == null || value === '') return null
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words">{String(value)}</dd>
    </>
  )
}

function MemberDetailPage() {
  const { memberId } = Route.useParams()
  const { data: m, isLoading } = useQuery(api.member.get.queryOptions({ memberId }))
  const { t } = useLingui()

  if (isLoading) return <Skeleton className="h-40 w-full" />
  if (!m) {
    return (
      <div className="space-y-3">
        <p className="text-muted-foreground">
          <Trans>Member not found.</Trans>
        </p>
        <Link to="/admin/members" className="text-primary underline">
          <Trans>← Back to members</Trans>
        </Link>
      </div>
    )
  }

  const raw = (m.raw ?? {}) as Record<string, unknown>
  const rawEntries = Object.entries(raw).filter(([, v]) => v !== '' && v != null)

  return (
    <div className="space-y-4">
      <Link to="/admin/members" className="text-sm text-primary underline">
        <Trans>← Back to members</Trans>
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {m.name}
            <Badge variant="outline">
              {m.role === 'library_admin' ? t`Admin` : t`Reader`}
            </Badge>
            {m.isPlaceholder && (
              <Badge variant="secondary">{t`placeholder`}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <Row label={t`Member no.`} value={m.memberNo} />
            <Row label={t`Phone`} value={m.phone} />
            <Row label={t`Email`} value={m.email} />
            <Row label={t`Plan`} value={m.membershipPlan} />
            <Row label={t`Employee no.`} value={m.employeeNo} />
            <Row label={t`Student no.`} value={m.studentNo} />
            <Row label={t`Class`} value={m.className} />
            <Row label={t`Department`} value={m.department} />
            <Row label={t`Address`} value={m.address} />
            <Row label={t`Room`} value={m.roomNo} />
            <Row label={t`Age`} value={m.age} />
            <Row label={t`Books out`} value={m.borrowedCount} />
            <Row label={t`Returned`} value={m.returnedCount} />
            <Row label={t`Joined`} value={m.joinedAt && new Date(m.joinedAt).toLocaleString()} />
            <Row label={t`Member since`} value={m.memberStart && new Date(m.memberStart).toLocaleString()} />
            <Row label={t`Member until`} value={m.memberExpiry && new Date(m.memberExpiry).toLocaleString()} />
            <Row label={t`Note`} value={m.note} />
          </dl>

          {rawEntries.length > 0 && (
            <details className="mt-4" data-testid="member-raw">
              <summary className="cursor-pointer text-sm font-semibold">
                <Trans>All source fields</Trans>
              </summary>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-xs">
                {rawEntries.map(([k, v]) => (
                  <Row key={k} label={k} value={v} />
                ))}
              </dl>
            </details>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
