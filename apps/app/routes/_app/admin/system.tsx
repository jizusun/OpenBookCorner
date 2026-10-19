import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Trans } from '@lingui/react/macro'
import { fetchConfig } from '@/lib/config'
import { Skeleton } from '@/components/ui/skeleton'
import { SystemInfo } from './SystemInfo'

export const Route = createFileRoute('/_app/admin/system')({
  pendingComponent: () => <Skeleton className="h-40 w-full" />,
  beforeLoad: ({ context }) => {
    if (context.user.role !== 'super_admin') throw redirect({ to: '/books' })
  },
  component: SystemPage,
})

function SystemPage() {
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'system', 'config'], queryFn: fetchConfig })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          <Trans>System settings</Trans>
        </h1>
        <p className="text-sm text-muted-foreground">
          <Trans>Read-only system information (super admin).</Trans>
        </p>
      </div>

      {isLoading ? <Skeleton className="h-40 w-full" /> : <SystemInfo config={data ?? null} />}
    </div>
  )
}
