import { Link, useLocation } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { Trans } from '@lingui/react/macro'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { navGroupsFor, homeFor } from './nav'
import { LibrarySwitcher } from './LibrarySwitcher'

export interface AppSidebarProps {
  role: string | null | undefined
  readerPreview: boolean
}

/**
 * shadcn-admin-style sidebar: brand header + role-grouped nav (via the pure
 * navGroupsFor). Active state comes from the router location; nav labels are
 * <Trans> nodes. The account menu lives in the top bar (UserMenu), not here.
 */
export function AppSidebar({ role, readerPreview }: AppSidebarProps) {
  const groups = navGroupsFor(role, readerPreview)
  const home = homeFor(role, readerPreview)
  const { pathname } = useLocation()
  const { isMobile, setOpenMobile } = useSidebar()

  // On mobile the sidebar is an overlay drawer (Sheet). After navigating it
  // should close itself so the user lands on the page they tapped — otherwise
  // the drawer stays open over the content. We close on pathname change (not a
  // link onClick, which doesn't fire reliably through the asChild Slot). On
  // desktop it's a persistent rail, so this is a no-op (isMobile is false).
  const prevPath = useRef(pathname)
  useEffect(() => {
    if (pathname !== prevPath.current) {
      prevPath.current = pathname
      if (isMobile) setOpenMobile(false)
    }
  }, [pathname, isMobile, setOpenMobile])

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <LibrarySwitcher
              brandFallback={
                <Link to={home} className="flex items-center gap-2 px-2 py-1.5 font-semibold">
                  <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    📚
                  </span>
                  <span className="truncate group-data-[collapsible=icon]:hidden">
                    <Trans>OpenBookCorner</Trans>
                  </span>
                </Link>
              }
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.id}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = pathname === item.to || pathname.startsWith(item.to + '/')
                  const Icon = item.icon
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild isActive={active} tooltip={undefined}>
                        <Link to={item.to} data-testid={`nav-${item.to}`}>
                          <Icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  )
}
