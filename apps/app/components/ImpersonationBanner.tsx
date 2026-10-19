import { Trans } from '@lingui/react/macro'
import { Button } from '@/components/ui/button'

export interface ImpersonationBannerProps {
  /** Whether the current session is an impersonation. */
  active: boolean
  /** Display name/email of the user being impersonated (optional). */
  viewingAs?: string | null
  /** Exit impersonation ("Back to my account"). */
  onExit: () => void
}

/**
 * Persistent top banner shown while a super admin is impersonating another user
 * (ADR 0004 Part B). Best-practice UX (Pigment + SaaS patterns):
 *  - always visible while impersonating (sticky, high-contrast),
 *  - clearly states WHO you are viewing as,
 *  - a prominent "Back to my account" exit (NOT "Sign out", which would end the
 *    admin's own session),
 *  - announced to assistive tech via role="status".
 */
export function ImpersonationBanner({ active, viewingAs, onExit }: ImpersonationBannerProps) {
  if (!active) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 flex items-center justify-between gap-2 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950"
    >
      <span>
        {viewingAs ? (
          <Trans>You are viewing as {viewingAs}. Actions are recorded.</Trans>
        ) : (
          <Trans>You are impersonating another user. Actions are recorded.</Trans>
        )}
      </span>
      <Button
        size="sm"
        variant="outline"
        onClick={onExit}
        className="border-amber-950/40 bg-amber-100 text-amber-950 hover:bg-amber-200"
      >
        <Trans>Back to my account</Trans>
      </Button>
    </div>
  )
}
