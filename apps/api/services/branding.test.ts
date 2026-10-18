import { describe, it, expect, beforeEach } from 'vitest'
import { TenantBrandingService } from './branding'
import { createTestDb } from '@obc/db/testing'
import { libraries, type Database as Db } from '@obc/db'

let db: Db

async function seedBranded(
  db: Db,
  id: string,
  slug: string | null,
  extra: Partial<{ logoUrl: string; brandColor: string; loginWelcome: string; isActive: boolean }> = {},
) {
  await db.insert(libraries).values({
    id,
    name: `Library ${id}`,
    emailDomains: ['@test.com'],
    settings: { borrowingPeriodDays: 14, maxBooksPerReader: 5, allowExtensions: false },
    isActive: extra.isActive ?? true,
    slug,
    logoUrl: extra.logoUrl ?? null,
    brandColor: extra.brandColor ?? null,
    loginWelcome: extra.loginWelcome ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
}

beforeEach(async () => {
  db = await createTestDb()
  await seedBranded(db, 'lib-acme', 'acme', {
    logoUrl: 'https://cdn/acme.png',
    brandColor: '#0a6ed1',
    loginWelcome: 'Welcome to Acme Library',
  })
  await seedBranded(db, 'lib-inactive', 'gone', { isActive: false })
})

describe('TenantBrandingService.getBySlug', () => {
  it('returns ONLY safe branding fields for an active tenant', async () => {
    const svc = new TenantBrandingService(db)
    const b = await svc.getBySlug('acme')
    expect(b).toEqual({
      name: 'Library lib-acme',
      logoUrl: 'https://cdn/acme.png',
      brandColor: '#0a6ed1',
      loginWelcome: 'Welcome to Acme Library',
    })
    // MUST NOT leak sensitive fields.
    expect(b).not.toHaveProperty('emailDomains')
    expect(b).not.toHaveProperty('settings')
    expect(b).not.toHaveProperty('id')
    expect(b).not.toHaveProperty('isActive')
  })

  it('returns null for an unknown slug', async () => {
    expect(await new TenantBrandingService(db).getBySlug('nope')).toBeNull()
  })

  it('returns null for a reserved/invalid slug without hitting the db result', async () => {
    const svc = new TenantBrandingService(db)
    expect(await svc.getBySlug('admin')).toBeNull()
    expect(await svc.getBySlug('AC_ME')).toBeNull()
  })

  it('returns null for an inactive tenant', async () => {
    expect(await new TenantBrandingService(db).getBySlug('gone')).toBeNull()
  })
})
