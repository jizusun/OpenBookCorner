import { useRouter } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useLingui } from '@lingui/react/macro'
import { ChevronsUpDown, Check, Plus, ShieldCheck, BookOpen, LogOut } from 'lucide-react'
import { api } from '@/lib/api'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { SidebarMenuButton } from '@/components/ui/sidebar'

/** Compact role badge — matches the shadcn-admin style. */
function RoleBadge({ role }: { role: string }) {
  const isAdmin = role === 'library_admin'
  return (
    <Badge
      variant={isAdmin ? 'default' : 'secondary'}
      className="h-4 shrink-0 gap-0.5 px-1.5 text-[10px] font-medium"
    >
      {isAdmin ? (
        <>
          <ShieldCheck className="size-2.5" />
          <Trans>Admin</Trans>
        </>
      ) : (
        <>
          <BookOpen className="size-2.5" />
          <Trans>Reader</Trans>
        </>
      )}
    </Badge>
  )
}

/**
 * Top-left library switcher (ADR 0009). Lists the user's active libraries with
 * their role and lets them switch the active one. The current library + role
 * are shown in the trigger so the user always knows their permission level.
 */
export function LibrarySwitcher({ brandFallback }: { brandFallback: React.ReactNode }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { t } = useLingui()
  const { data } = useQuery(api.membership.mine.queryOptions())
  const libraries = data ?? []
  const active = libraries.find((l) => l.active) ?? libraries[0]

  const switchLib = useMutation({
    ...api.membership.switch.mutationOptions(),
    onSuccess: async () => {
      queryClient.clear()
      await router.invalidate()
      await router.navigate({ to: '/books' })
    },
  })

  const leaveLib = useMutation({
    ...api.membership.leave.mutationOptions(),
    onSuccess: async () => {
      queryClient.clear()
      await router.invalidate()
      await router.navigate({ to: '/welcome' })
    },
  })

  // No memberships (super admin or brand-new user): just show the brand.
  if (libraries.length === 0) return <>{brandFallback}</>

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton size="lg" data-testid="library-switcher">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            📚
          </span>
          <div className="flex min-w-0 flex-col text-left group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-semibold leading-tight">
              {active?.name ?? 'OpenBookCorner'}
            </span>
            {active?.role && (
              <span className="text-[10px] leading-tight text-muted-foreground">
                {active.role === 'library_admin' ? <Trans>Admin</Trans> : <Trans>Reader</Trans>}
              </span>
            )}
          </div>
          <ChevronsUpDown className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          <Trans>Your libraries</Trans>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {libraries.map((lib) => (
          <DropdownMenuItem
            key={lib.libraryId}
            data-testid={`switch-lib-${lib.libraryId}`}
            className="flex items-center gap-2"
            onClick={() => {
              if (!lib.active) switchLib.mutate({ libraryId: lib.libraryId })
            }}
          >
            <span className="flex-1 truncate">{lib.name}</span>
            <RoleBadge role={lib.role} />
            {lib.active && <Check className="size-4 shrink-0 text-primary" />}
            <button
              type="button"
              className="ml-1 rounded p-0.5 text-muted-foreground hover:text-destructive"
              title={t`Leave this library`}
              data-testid={`leave-lib-${lib.libraryId}`}
              onClick={(e) => {
                e.stopPropagation()
                if (window.confirm(t`Leave ${lib.name}? You will lose access.`)) {
                  leaveLib.mutate({ libraryId: lib.libraryId })
                }
              }}
            >
              <LogOut className="size-3.5" />
            </button>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          data-testid="switcher-create"
          onClick={() => router.navigate({ to: '/welcome' })}
        >
          <Plus className="size-4" />
          <Trans>Create or join a library</Trans>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
