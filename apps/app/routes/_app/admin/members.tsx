import { useState } from 'react'
import { createFileRoute, redirect, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { Trans, Plural, useLingui } from '@lingui/react/macro'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { useInfiniteList, LoadMoreSentinel } from '@/components/InfiniteList'

const searchSchema = z.object({
  q: z.string().optional(),
  sort: z.enum(['name', 'joinedAt', 'borrowedCount', 'memberExpiry']).optional(),
  dir: z.enum(['asc', 'desc']).optional(),
  role: z.enum(['library_admin', 'library_reader']).optional(),
  plan: z.string().optional(),
})

export const Route = createFileRoute('/_app/admin/members')({
  validateSearch: searchSchema,
  beforeLoad: ({ context }) => {
    if (context.user.role !== 'library_admin' && context.user.role !== 'super_admin') {
      throw redirect({ to: '/books' })
    }
  },
  component: MembersPage,
})

const PAGE_SIZE = 50
type Member = Awaited<ReturnType<typeof api.member.list.query>>['items'][number]

function MembersPage() {
  const { q, sort, dir, role, plan } = Route.useSearch()
  const navigate = Route.useNavigate()
  const [term, setTerm] = useState(q ?? '')
  const { t } = useLingui()

  const { data: facets } = useQuery(api.member.facets.queryOptions())

  const baseInput = { search: q, limit: PAGE_SIZE, sortBy: sort, sortDir: dir, role, plan }
  const infinite = useInfiniteList<Member>(['member.list.infinite', baseInput], (page) =>
    api.member.list.query({ ...baseInput, page }),
  )
  const items = infinite.items

  function submit(e: React.FormEvent) {
    e.preventDefault()
    navigate({ search: (prev) => ({ ...prev, q: term.trim() || undefined }) })
  }
  const setParam = (key: keyof typeof searchSchema.shape, value: string | undefined) =>
    navigate({ search: (prev) => ({ ...prev, [key]: value || undefined }) })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          <Trans>Members</Trans>
        </h1>
        {!infinite.isLoading && (
          <span className="text-sm text-muted-foreground">
            <Plural value={infinite.total} one="# member" other="# members" />
          </span>
        )}
      </div>

      <form onSubmit={submit} className="flex gap-2" data-testid="member-search-form">
        <Input
          placeholder={t`Search by name / phone / member no…`}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          data-testid="member-search-input"
          aria-label={t`Search members`}
        />
        <Button type="submit" variant="outline">
          <Trans>Search</Trans>
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="member-controls">
        <label className="flex items-center gap-1">
          <span className="text-muted-foreground">
            <Trans>Sort</Trans>
          </span>
          <select
            className="rounded-md border px-2 py-1"
            data-testid="member-sort-select"
            value={sort ?? 'name'}
            onChange={(e) => setParam('sort', e.target.value === 'name' ? undefined : e.target.value)}
          >
            <option value="name">{t`Name`}</option>
            <option value="joinedAt">{t`Joined date`}</option>
            <option value="borrowedCount">{t`Books out`}</option>
            <option value="memberExpiry">{t`Expiry date`}</option>
          </select>
        </label>
        <select
          className="rounded-md border px-2 py-1"
          data-testid="member-dir-select"
          value={dir ?? 'asc'}
          onChange={(e) => setParam('dir', e.target.value === 'asc' ? undefined : e.target.value)}
        >
          <option value="asc">{t`Ascending`}</option>
          <option value="desc">{t`Descending`}</option>
        </select>
        <select
          className="rounded-md border px-2 py-1"
          data-testid="member-role-select"
          value={role ?? ''}
          onChange={(e) => setParam('role', e.target.value || undefined)}
        >
          <option value="">{t`All roles`}</option>
          <option value="library_admin">{t`Admin`}</option>
          <option value="library_reader">{t`Reader`}</option>
        </select>
        {facets && facets.plans.length > 0 && (
          <select
            className="rounded-md border px-2 py-1"
            data-testid="member-plan-select"
            value={plan ?? ''}
            onChange={(e) => setParam('plan', e.target.value || undefined)}
          >
            <option value="">{t`All plans`}</option>
            {facets.plans.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        )}
      </div>

      {infinite.isLoading && (
        <p className="text-muted-foreground">
          <Trans>Loading…</Trans>
        </p>
      )}

      {!infinite.isLoading && items.length === 0 && (
        <EmptyState
          icon="👥"
          title={<Trans>No members yet</Trans>}
          description={<Trans>Import 番薯 data or adjust the search/filters.</Trans>}
        />
      )}

      {items.length > 0 && (
        <div className="overflow-x-auto rounded-md border" data-testid="members-table">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2">
                  <Trans>Name</Trans>
                </th>
                <th className="px-3 py-2">
                  <Trans>Role</Trans>
                </th>
                <th className="px-3 py-2">
                  <Trans>Phone</Trans>
                </th>
                <th className="px-3 py-2">
                  <Trans>Member no.</Trans>
                </th>
                <th className="px-3 py-2">
                  <Trans>Out</Trans>
                </th>
                <th className="px-3 py-2">
                  <Trans>Returned</Trans>
                </th>
                <th className="px-3 py-2">
                  <Trans>Expiry</Trans>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id} className="border-t hover:bg-accent/40">
                  <td className="px-3 py-2 font-medium">
                    <Link
                      to="/admin/members/$memberId"
                      params={{ memberId: m.id }}
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      {m.name}
                    </Link>
                    {m.isPlaceholder && (
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        {t`placeholder`}
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2">{m.role === 'library_admin' ? t`Admin` : t`Reader`}</td>
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

      <LoadMoreSentinel
        hasNextPage={infinite.hasNextPage}
        isFetchingNextPage={infinite.isFetchingNextPage}
        fetchNextPage={() => infinite.fetchNextPage()}
      />
    </div>
  )
}
