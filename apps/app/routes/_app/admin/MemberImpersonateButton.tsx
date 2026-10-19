import { useState } from 'react'
import { Trans } from '@lingui/react/macro'
import { authClient } from '@/lib/auth-client'
import { canShowImpersonateAction } from '@/lib/impersonation'
import { Button } from '@/components/ui/button'

export interface MemberImpersonateButtonProps {
  /** The current viewer's role (only super_admin may impersonate). */
  viewerRole: string | null | undefined
  /** The current viewer's user id (cannot impersonate yourself). */
  viewerId: string
  /** The member's linked Better Auth user id, or null if unlinked. */
  memberUserId: string | null | undefined
  /** Navigate into the app as the impersonated user (e.g. router.navigate). */
  onImpersonated: () => void | Promise<void>
  /** Clear cached queries so the impersonated identity takes effect. */
  clearCache: () => void
}

/**
 * Super-admin-only "Impersonate" action for a member row (ADR 0004 Part B).
 * Least-privilege: shown only when the viewer is a super admin, the target is a
 * DIFFERENT user, and the member has a linked login account (`memberUserId`) —
 * members imported without an account cannot be impersonated.
 */
export function MemberImpersonateButton({
  viewerRole,
  viewerId,
  memberUserId,
  onImpersonated,
  clearCache,
}: MemberImpersonateButtonProps) {
  const [pending, setPending] = useState(false)

  if (!memberUserId) return null
  if (!canShowImpersonateAction(viewerRole, memberUserId, viewerId)) return null

  async function handleClick() {
    setPending(true)
    try {
      await authClient.admin.impersonateUser({ userId: memberUserId as string })
      clearCache()
      await onImpersonated()
    } finally {
      setPending(false)
    }
  }

  return (
    <Button size="sm" variant="outline" disabled={pending} onClick={handleClick}>
      <Trans>Sign in as them</Trans>
    </Button>
  )
}
