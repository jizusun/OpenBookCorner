import { useRouter } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans } from '@lingui/react/macro'
import { ChevronsUpDown, Check, Plus } from 'lucide-react'
import { api } from '@/lib/api'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SidebarMenuButton } from '@/components/ui/sidebar'

/**
 * Top-left library switcher (ADR 0009). Lists the user's active libraries and
 * lets them switch the active one; switching persists `active_library_id`
 * server-side, then refreshes identity + reloads into the library. A super
 * admin sees only the brand (no memberships) — handled by the caller.
 */
export function LibrarySwitcher({ brandFallback }: { brandFallback: React.ReactNode }) {
  const router = useRouter()
  const queryClient = useQueryClient()
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

  // No memberships (e.g. super admin or brand-new user): just show the brand.
  if (libraries.length === 0) return <>{brandFallback}</>

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton size="lg" data-testid="library-switcher">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            📚
          </span>
          <span className="truncate text-left font-semibold group-data-[collapsible=icon]:hidden">
            {active?.name ?? 'OpenBookCorner'}
          </span>
          <ChevronsUpDown className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel>
          <Trans>Libraries</Trans>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {libraries.map((lib) => (
          <DropdownMenuItem
            key={lib.libraryId}
            data-testid={`switch-lib-${lib.libraryId}`}
            onClick={() => {
              if (!lib.active) switchLib.mutate({ libraryId: lib.libraryId })
            }}
          >
            <span className="flex-1 truncate">{lib.name}</span>
            {lib.active && <Check className="size-4" />}
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
