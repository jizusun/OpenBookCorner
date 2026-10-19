import { createFileRoute, redirect, Outlet } from '@tanstack/react-router'

/**
 * Tenants layout route. The list lives in `tenants.index.tsx` (/admin/tenants)
 * and the detail in `tenants.$libraryId.tsx` (/admin/tenants/:id); this parent
 * only renders the matched child via <Outlet/>. Without this Outlet the detail
 * route's URL would change but nothing would render (the drill-down bug).
 * Super-admin guard applies to the whole subtree.
 */
export const Route = createFileRoute('/_app/admin/tenants')({
  beforeLoad: ({ context }) => {
    if (context.user.role !== 'super_admin') throw redirect({ to: '/books' })
  },
  component: () => <Outlet />,
})
