import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { trpc } from '@/lib/trpc'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'

const searchSchema = z.object({ q: z.string().optional(), page: z.number().int().min(1).optional() })

export const Route = createFileRoute('/_app/admin/members')({
  validateSearch: searchSchema,
  beforeLoad: ({ context }) => {
    if (context.user.role !== 'library_admin' && context.user.role !== 'super_admin') {
      throw redirect({ to: '/books' })
    }
  },
  component: MembersPage,
})

function MembersPage() {
  const { q, page } = Route.useSearch()
  const navigate = Route.useNavigate()
  const [term, setTerm] = useState(q ?? '')
  const currentPage = page ?? 1

  const { data, isLoading } = useQuery(
    trpc.member.list.queryOptions({ search: q, page: currentPage, limit: 50 }),
  )
  const items = data?.items ?? []
  const totalPages = data?.totalPages ?? 1

  function submit(e: React.FormEvent) {
    e.preventDefault()
    navigate({ search: { q: term.trim() || undefined, page: undefined } })
  }
  const goPage = (p: number) =>
    navigate({ search: (prev) => ({ ...prev, page: p === 1 ? undefined : p }) })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">成员 Members</h1>
        {data && <span className="text-sm text-muted-foreground">共 {data.total} 位</span>}
      </div>

      <form onSubmit={submit} className="flex gap-2" data-testid="member-search-form">
        <Input
          placeholder="按姓名 / 手机 / 会员号搜索…"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          data-testid="member-search-input"
          aria-label="Search members"
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      {isLoading && <p className="text-muted-foreground">Loading…</p>}

      {!isLoading && items.length === 0 && (
        <EmptyState icon="👥" title="没有成员" description="导入 番薯 数据或调整搜索。" />
      )}

      {items.length > 0 && (
        <div className="overflow-x-auto rounded-md border" data-testid="members-table">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2">姓名</th>
                <th className="px-3 py-2">权限</th>
                <th className="px-3 py-2">手机</th>
                <th className="px-3 py-2">会员号</th>
                <th className="px-3 py-2">在借</th>
                <th className="px-3 py-2">已还</th>
                <th className="px-3 py-2">到期</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="px-3 py-2 font-medium">
                    {m.name}
                    {m.isPlaceholder && (
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        placeholder
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {m.role === 'library_admin' ? '管理员' : '普通成员'}
                  </td>
                  <td className="px-3 py-2">{m.phone ?? '—'}</td>
                  <td className="px-3 py-2">{m.memberNo ?? '—'}</td>
                  <td className="px-3 py-2">{m.borrowedCount ?? 0}</td>
                  <td className="px-3 py-2">{m.returnedCount ?? 0}</td>
                  <td className="px-3 py-2">
                    {m.memberExpiry ? new Date(m.memberExpiry).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => goPage(currentPage - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => goPage(currentPage + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
