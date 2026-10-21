import { Link, useLocation } from '@tanstack/react-router'
import { Trans } from '@lingui/react/macro'
import { ChevronsUpDown, LogOut, Download, User } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { navGroupsFor, homeFor } from './nav'
import { UserAvatar } from '@/components/UserAvatar'

export interface AppSidebarProps {
  role: string | null | undefined
  readerPreview: boolean
  userName: string
  onLogout: () => void
  canInstall: boolean
  onInstall: () => void
}

/**
 * shadcn-admin-style sidebar: brand header, role-grouped nav (via the pure
 * navGroupsFor), and a footer user menu (name + Install + Sign out). Active
 * state comes from the router location; nav labels are <Trans> nodes.
 */
export function AppSidebar({
  role,
  readerPreview,
  userName,
  onLogout,
  canInstall,
  onInstall,
}: AppSidebarProps) {
  const groups = navGroupsFor(role, readerPreview)
  const home = homeFor(role, readerPreview)
  const { pathname } = useLocation()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link to={home} className="flex items-center gap-2 px-2 py-1.5 font-semibold">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            📚
          </span>
          <span className="truncate group-data-[collapsible=icon]:hidden">
            <Trans>OpenBookCorner</Trans>
          </span>
        </Link>
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

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" data-testid="user-menu">
                  <UserAvatar name={userName} size="sm" />
                  <span className="truncate group-data-[collapsible=icon]:hidden">{userName}</span>
                  <ChevronsUpDown className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuLabel className="truncate"><Trans>Signed in as {userName}</Trans></DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild data-testid="profile-link">
                  <Link to="/profile">
                    <User />
                    <Trans>Profile</Trans>
                  </Link>
                </DropdownMenuItem>
                {canInstall && (
                  <DropdownMenuItem onClick={onInstall} data-testid="install-button">
                    <Download />
                    <Trans>Install app</Trans>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={onLogout} data-testid="logout">
                  <LogOut />
                  <Trans>Sign out</Trans>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
