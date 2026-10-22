import { createFileRoute, redirect } from '@tanstack/react-router'
import { api } from '@/lib/api'
import { queryClient } from '@/lib/query'

/**
 * /switch/:libraryId — auto-switches the active library and redirects to
 * the library's catalog. Designed for QR codes and shareable links so users
 * land directly in the right library context. If the user is not a member,
 * they are silently forwarded to /books (their current active library).
 *
 * URL to share: https://app.example.com/switch/<libraryId>
 * The URL is stable (library ID never changes) and works as a QR code target.
 */
export const Route = createFileRoute('/switch/$libraryId')({
  beforeLoad: async ({ params }) => {
    try {
      await api.membership.switch.mutate({ libraryId: params.libraryId })
      queryClient.clear()
    } catch {
      // Not a member or invalid id — silently fall through to /books.
    }
    throw redirect({ to: '/books' })
  },
})
