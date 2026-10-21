import { cn } from '@/lib/utils'

export interface UserAvatarProps {
  name: string
  /** Avatar diameter preset. */
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZES: Record<NonNullable<UserAvatarProps['size']>, string> = {
  sm: 'size-7 text-xs',
  md: 'size-9 text-sm',
  lg: 'size-16 text-xl',
}

// A small, stable palette; pick by a cheap hash of the name so a given user
// always gets the same colour (no storage needed).
const PALETTE = [
  'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200',
  'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200',
  'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-200',
  'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200',
  'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200',
  'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-200',
]

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0]!
  if (parts.length === 1) return first.slice(0, 2).toUpperCase()
  const last = parts[parts.length - 1]!
  return (first[0]! + last[0]!).toUpperCase()
}

function colorFor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]!
}

/**
 * Initials avatar. No image upload in Phase 1 — a deterministic coloured
 * initials badge gives each user a recognizable icon across the app
 * (sidebar user menu, profile page).
 */
export function UserAvatar({ name, size = 'md', className }: UserAvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-medium',
        SIZES[size],
        colorFor(name),
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}
