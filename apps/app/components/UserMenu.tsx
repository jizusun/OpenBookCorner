import { Link } from '@tanstack/react-router'
import { Trans } from '@lingui/react/macro'
import { LogOut, Download, User } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { UserAvatar } from '@/components/UserAvatar'

export interface UserMenuProps {
  userName: string
  onLogout: () => void
  canInstall: boolean
  onInstall: () => void
}

/**
 * Top-right account menu: an avatar button that opens Profile / Install /
 * Sign out. Used in the authenticated top bar (the conventional corner for an
 * account menu). Keeps the same testids the app/E2E rely on
 * (user-menu, profile-link, install-button, logout).
 */
export function UserMenu({ userName, onLogout, canInstall, onInstall }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-testid="user-menu"
          aria-label={userName}
          className="flex items-center rounded-full outline-hidden ring-sidebar-ring focus-visible:ring-2"
        >
          <UserAvatar name={userName} size="sm" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="end" className="w-56">
        <DropdownMenuLabel className="truncate">
          <Trans>Signed in as {userName}</Trans>
        </DropdownMenuLabel>
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
  )
}
