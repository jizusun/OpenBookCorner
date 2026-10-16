import { describe, it, expect, beforeEach } from 'vitest'
import { TenantAdminService, BookService } from './index'
import { createTestDb, seedLibrary, seedUser, seedBook } from '@obc/db/testing'
import type { Database as Db } from '@obc/db'

let db: Db

beforeEach(async () => {
  db = await createTestDb()
})

describe('TenantAdminService (super-admin, cross-tenant)', () => {
  it('lists all libraries with book + member counts', async () => {
    await seedLibrary(db, 'lib-a')
    await seedLibrary(db, 'lib-b')
    await seedUser(db, 'u1', 'lib-a')
    await seedUser(db, 'u2', 'lib-a')
    await seedBook(db, 'bk1', 'lib-a')

    const svc = new TenantAdminService(db)
    const all = await svc.listAll()

    expect(all).toHaveLength(2)
    const a = all.find((l) => l.id === 'lib-a')!
    const b = all.find((l) => l.id === 'lib-b')!
    expect(a.memberCount).toBe(2)
    expect(a.bookCount).toBe(1)
    expect(b.memberCount).toBe(0)
    expect(b.bookCount).toBe(0)
  })

  it('creates a new library with default settings and active status', async () => {
    const svc = new TenantAdminService(db)
    const { id } = await svc.create({ name: 'Acme Library', emailDomains: ['@acme.com'] })
    expect(id).toBeTruthy()

    const all = await svc.listAll()
    const created = all.find((l) => l.id === id)!
    expect(created.name).toBe('Acme Library')
    expect(created.emailDomains).toEqual(['@acme.com'])
    expect(created.isActive).toBe(true)
    expect(created.bookCount).toBe(0)
  })

  it('activates and deactivates a library', async () => {
    await seedLibrary(db, 'lib-x')
    const svc = new TenantAdminService(db)

    const off = await svc.setActive('lib-x', false)
    expect(off).toEqual({ id: 'lib-x', isActive: false })
    expect((await svc.listAll()).find((l) => l.id === 'lib-x')!.isActive).toBe(false)

    await svc.setActive('lib-x', true)
    expect((await svc.listAll()).find((l) => l.id === 'lib-x')!.isActive).toBe(true)
  })

  it('new library is immediately visible to its own catalog (tenant isolation intact)', async () => {
    const svc = new TenantAdminService(db)
    const { id } = await svc.create({ name: 'Beta', emailDomains: ['@beta.com'] })
    await seedBook(db, 'beta-book', id)
    const books = await new BookService(db).listByLibrary(id)
    expect(books.items).toHaveLength(1)
    // A different library sees none of Beta's books.
    await seedLibrary(db, 'other')
    expect((await new BookService(db).listByLibrary('other')).items).toHaveLength(0)
  })
})
