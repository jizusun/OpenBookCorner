import type { ReactNode } from 'react'
import { Trans } from '@lingui/react/macro'
import {
  BookOpen,
  Building2,
  ClipboardList,
  Compass,
  FormInput,
  LayoutDashboard,
  Link2,
  ListChecks,
  MailOpen,
  ScanLine,
  Settings,
  Upload,
  Users,
  Library,
  MessageSquare,
  ScrollText,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: ReactNode
  icon: LucideIcon
}

export interface NavGroup {
  id: 'system' | 'library' | 'reader'
  label: ReactNode
  items: NavItem[]
}

const SYSTEM: NavGroup = {
  id: 'system',
  label: <Trans>System</Trans>,
  items: [
    { to: '/admin/overview', label: <Trans>Overview</Trans>, icon: LayoutDashboard },
    { to: '/admin/tenants', label: <Trans>Tenants</Trans>, icon: Building2 },
    { to: '/admin/users', label: <Trans>Users</Trans>, icon: Users },
    { to: '/admin/books', label: <Trans>Books</Trans>, icon: BookOpen },
    { to: '/admin/audit', label: <Trans>Audit log</Trans>, icon: ScrollText },
    { to: '/admin/system', label: <Trans>System settings</Trans>, icon: Settings },
  ],
}

const LIBRARY: NavGroup = {
  id: 'library',
  label: <Trans>Library</Trans>,
  items: [
    { to: '/books', label: <Trans>Catalog</Trans>, icon: BookOpen },
    { to: '/admin/members', label: <Trans>Readers</Trans>, icon: Users },
    { to: '/admin/overdue', label: <Trans>Overdue</Trans>, icon: ListChecks },
    { to: '/admin/settings', label: <Trans>Settings</Trans>, icon: Settings },
    { to: '/admin/feedback', label: <Trans>Feedback</Trans>, icon: MessageSquare },
    { to: '/admin/join-requests', label: <Trans>Join requests</Trans>, icon: MailOpen },
    { to: '/admin/join-form', label: <Trans>Join form</Trans>, icon: FormInput },
    { to: '/admin/invites', label: <Trans>Invite links</Trans>, icon: Link2 },
    { to: '/admin/activity', label: <Trans>Activity</Trans>, icon: ClipboardList },
    { to: '/admin/import', label: <Trans>Import</Trans>, icon: Upload },
  ],
}

const READER: NavGroup = {
  id: 'reader',
  label: <Trans>Reader</Trans>,
  items: [
    { to: '/my-books', label: <Trans>My Books</Trans>, icon: Library },
    { to: '/scan', label: <Trans>Scan</Trans>, icon: ScanLine },
    { to: '/books', label: <Trans>Catalog</Trans>, icon: BookOpen },
    { to: '/discover', label: <Trans>Discover</Trans>, icon: Compass },
  ],
}

/**
 * Role (+ reader-preview) → sidebar nav groups. Pure so the mapping is unit-
 * tested independently of the shell. super_admin sees the System console;
 * library_admin sees the Library group (or the Reader group while previewing as
 * a member); readers see the Reader group. Mirrors the retired view-switch
 * surfaces (ADR 0006/0007) without a switch.
 */
export function navGroupsFor(
  role: string | null | undefined,
  readerPreview: boolean,
): NavGroup[] {
  if (role === 'super_admin') return [SYSTEM]
  if (role === 'library_admin') return readerPreview ? [READER] : [LIBRARY]
  return [READER]
}

/** Landing route for a role/surface (sidebar brand link + post-action nav). */
export function homeFor(role: string | null | undefined, readerPreview: boolean): string {
  if (role === 'super_admin') return '/admin/overview'
  if (role === 'library_admin' && !readerPreview) return '/books'
  return '/my-books'
}
