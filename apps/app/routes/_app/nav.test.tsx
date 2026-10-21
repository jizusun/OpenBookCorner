import { describe, it, expect } from 'vitest'

import { navGroupsFor, type NavGroup } from './nav'

function ids(groups: NavGroup[]): string[] {
  return groups.flatMap((g) => g.items.map((i) => i.to))
}

describe('navGroupsFor', () => {
  it('super_admin → a single System group with the 6 console pages', () => {
    const groups = navGroupsFor('super_admin', false)
    expect(groups).toHaveLength(1)
    expect(groups[0].id).toBe('system')
    expect(ids(groups)).toEqual([
      '/admin/overview',
      '/admin/tenants',
      '/admin/users',
      '/admin/books',
      '/admin/audit',
      '/admin/system',
    ])
  })

  it('library_admin (no reader preview) → 3 Library groups', () => {
    const groups = navGroupsFor('library_admin', false)
    expect(groups.map((g) => g.id)).toEqual(['library', 'library-members', 'library-more'])
    expect(ids(groups)).toEqual([
      '/books', '/admin/members', '/admin/overdue',          // Library
      '/admin/join-requests', '/admin/invites',              // Members
      '/admin/feedback', '/admin/activity', '/admin/settings', '/admin/import', // More
    ])
  })

  it('library_admin WITH reader preview → the Reader group (browsing as a member)', () => {
    const groups = navGroupsFor('library_admin', true)
    expect(groups.map((g) => g.id)).toEqual(['reader'])
    expect(ids(groups)).toEqual(['/my-books', '/scan', '/books', '/discover'])
  })

  it('library_reader → the Reader group', () => {
    const groups = navGroupsFor('library_reader', false)
    expect(groups.map((g) => g.id)).toEqual(['reader'])
    expect(ids(groups)).toEqual(['/my-books', '/scan', '/books', '/discover'])
  })

  it('every item has a stable key, a label node, and a route', () => {
    for (const role of ['super_admin', 'library_admin', 'library_reader'] as const) {
      for (const g of navGroupsFor(role, false)) {
        expect(g.label).toBeTruthy()
        for (const it of g.items) {
          expect(typeof it.to).toBe('string')
          expect(it.label).toBeTruthy()
        }
      }
    }
  })
})
