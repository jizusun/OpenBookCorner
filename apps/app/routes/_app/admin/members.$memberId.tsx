import { createFileRoute, redirect, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { trpc } from '@/lib/trpc'
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
  const { data: m, isLoading } = useQuery(trpc.member.get.queryOptions({ memberId }))

  if (isLoading) return <Skeleton className="h-40 w-full" />
  if (!m) {
    return (
      <div className="space-y-3">
        <p className="text-muted-foreground">Member not found.</p>
        <Link to="/admin/members" className="text-primary underline">
          ← Back to members
        </Link>
      </div>
    )
  }

  const raw = (m.raw ?? {}) as Record<string, unknown>
  const rawEntries = Object.entries(raw).filter(([, v]) => v !== '' && v != null)

  return (
    <div className="space-y-4">
      <Link to="/admin/members" className="text-sm text-primary underline">
        ← Back to members
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {m.name}
            <Badge variant="outline">{m.role === 'library_admin' ? '管理员' : '普通成员'}</Badge>
            {m.isPlaceholder && <Badge variant="secondary">placeholder</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <Row label="会员号" value={m.memberNo} />
            <Row label="手机" value={m.phone} />
            <Row label="邮箱" value={m.email} />
            <Row label="会员计划" value={m.membershipPlan} />
            <Row label="工号" value={m.employeeNo} />
            <Row label="学号" value={m.studentNo} />
            <Row label="班级" value={m.className} />
            <Row label="部门" value={m.department} />
            <Row label="地址" value={m.address} />
            <Row label="房号" value={m.roomNo} />
            <Row label="年龄" value={m.age} />
            <Row label="在借数量" value={m.borrowedCount} />
            <Row label="已还数量" value={m.returnedCount} />
            <Row label="入馆日期" value={m.joinedAt && new Date(m.joinedAt).toLocaleString()} />
            <Row label="会员起始" value={m.memberStart && new Date(m.memberStart).toLocaleString()} />
            <Row label="会员到期" value={m.memberExpiry && new Date(m.memberExpiry).toLocaleString()} />
            <Row label="备注" value={m.note} />
          </dl>

          {rawEntries.length > 0 && (
            <details className="mt-4" data-testid="member-raw">
              <summary className="cursor-pointer text-sm font-semibold">
                原始数据 / All source fields
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
