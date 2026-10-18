import { createFileRoute, redirect, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { trpc } from '@/lib/trpc'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useI18n } from '@/lib/i18n'

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
  const { data: m, isLoading } = useQuery(trpc.member.get.queryOptions({ memberId }))
  const { t } = useI18n()

  if (isLoading) return <Skeleton className="h-40 w-full" />
  if (!m) {
    return (
      <div className="space-y-3">
        <p className="text-muted-foreground">{t('memberDetail.notFound')}</p>
        <Link to="/admin/members" className="text-primary underline">
          {t('memberDetail.back')}
        </Link>
      </div>
    )
  }

  const raw = (m.raw ?? {}) as Record<string, unknown>
  const rawEntries = Object.entries(raw).filter(([, v]) => v !== '' && v != null)

  return (
    <div className="space-y-4">
      <Link to="/admin/members" className="text-sm text-primary underline">
        {t('memberDetail.back')}
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {m.name}
            <Badge variant="outline">{m.role === 'library_admin' ? t('members.role.admin') : t('members.role.reader')}</Badge>
            {m.isPlaceholder && <Badge variant="secondary">{t('members.placeholder')}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <Row label={t('memberDetail.memberNo')} value={m.memberNo} />
            <Row label={t('memberDetail.phone')} value={m.phone} />
            <Row label={t('memberDetail.email')} value={m.email} />
            <Row label={t('memberDetail.plan')} value={m.membershipPlan} />
            <Row label={t('memberDetail.employeeNo')} value={m.employeeNo} />
            <Row label={t('memberDetail.studentNo')} value={m.studentNo} />
            <Row label={t('memberDetail.className')} value={m.className} />
            <Row label={t('memberDetail.department')} value={m.department} />
            <Row label={t('memberDetail.address')} value={m.address} />
            <Row label={t('memberDetail.roomNo')} value={m.roomNo} />
            <Row label={t('memberDetail.age')} value={m.age} />
            <Row label={t('memberDetail.borrowedCount')} value={m.borrowedCount} />
            <Row label={t('memberDetail.returnedCount')} value={m.returnedCount} />
            <Row label={t('memberDetail.joinedAt')} value={m.joinedAt && new Date(m.joinedAt).toLocaleString()} />
            <Row label={t('memberDetail.memberStart')} value={m.memberStart && new Date(m.memberStart).toLocaleString()} />
            <Row label={t('memberDetail.memberExpiry')} value={m.memberExpiry && new Date(m.memberExpiry).toLocaleString()} />
            <Row label={t('memberDetail.note')} value={m.note} />
          </dl>

          {rawEntries.length > 0 && (
            <details className="mt-4" data-testid="member-raw">
              <summary className="cursor-pointer text-sm font-semibold">
                {t('memberDetail.rawFields')}
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
