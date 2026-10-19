import { describe, it, expect, beforeEach } from 'vitest'
import { TenantAdminService, BookService } from './index'
import { createTestDb, seedLibrary, seedUser, seedBook, seedMember } from '@obc/db/testing'
import type { Database as Db } from '@obc/db'

let db: Db

beforeEach(async () => {
  db = await createTestDb()
})

describe('TenantAdminService (super-admin, cross-tenant)', () => {
  it('lists all libraries with book + member counts', async () => {
    await seedLibrary(db, 'lib-a')
    await seedLibrary(db, 'lib-b')
    await seedMember(db, 'm1', 'lib-a')
    await seedMember(db, 'm2', 'lib-a')
    await seedBook(db, 'bk1', 'lib-a')

    const svc = new TenantAdminService(db)
    const all = await svc.listAll()

    expect(all).toHaveLength(2)
    const a = all.find((l) => l.id === 'lib-a')!
    const b = all.find((l) => l.id === 'lib-b')!
    expect(a.memberCount).toBe(2) // counts members records (same as detail page)
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
    expect(off).toEqual({ id: 'lib-x', isActive: false, updated: true })
    expect((await svc.listAll()).find((l) => l.id === 'lib-x')!.isActive).toBe(false)

    await svc.setActive('lib-x', true)
    expect((await svc.listAll()).find((l) => l.id === 'lib-x')!.isActive).toBe(true)

    // Unknown id → not updated (handler returns 404, no audit).
    expect((await svc.setActive('nope', false)).updated).toBe(false)
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

  it('auto-generates a valid slug from the name and exposes it in listAll', async () => {
    const svc = new TenantAdminService(db)
    const { id, slug } = await svc.create({ name: 'Acme Library', emailDomains: ['@acme.com'] })
    expect(slug).toBe('acme-library')
    const created = (await svc.listAll()).find((l) => l.id === id)!
    expect(created.slug).toBe('acme-library')
  })

  it('disambiguates a duplicate slug with a numeric suffix', async () => {
    const svc = new TenantAdminService(db)
    const a = await svc.create({ name: 'Acme Library', emailDomains: ['@a.com'] })
    const b = await svc.create({ name: 'Acme Library', emailDomains: ['@b.com'] })
    expect(a.slug).toBe('acme-library')
    expect(b.slug).toBe('acme-library-2')
  })

  it('honors an explicit valid slug on create', async () => {
    const svc = new TenantAdminService(db)
    const { slug } = await svc.create({ name: 'Whatever', emailDomains: ['@w.com'], slug: 'globex' })
    expect(slug).toBe('globex')
  })

  describe('update', () => {
    it('updates name, domains, branding, and slug', async () => {
      const svc = new TenantAdminService(db)
      const { id } = await svc.create({ name: 'Acme Library', emailDomains: ['@acme.com'] })
      const res = await svc.update(id, {
        name: 'Acme Books',
        emailDomains: ['@acme.io'],
        slug: 'acme-books',
        brandColor: '#123456',
        loginWelcome: 'Hi',
      })
      expect(res.updated).toBe(true)
      const l = (await svc.listAll()).find((x) => x.id === id)!
      expect(l.name).toBe('Acme Books')
      expect(l.emailDomains).toEqual(['@acme.io'])
      expect(l.slug).toBe('acme-books')
      expect(l.brandColor).toBe('#123456')
      expect(l.loginWelcome).toBe('Hi')
    })

    it('rejects an invalid slug and a slug already taken by another tenant', async () => {
      const svc = new TenantAdminService(db)
      const a = await svc.create({ name: 'Acme', emailDomains: ['@a.com'], slug: 'acme' })
      const b = await svc.create({ name: 'Beta', emailDomains: ['@b.com'], slug: 'beta' })
      expect((await svc.update(b.id, { slug: 'AC_ME' })).error).toBe('INVALID_SLUG')
      expect((await svc.update(b.id, { slug: 'acme' })).error).toBe('SLUG_TAKEN')
      // keeping its own slug is fine (no-op clash with itself)
      expect((await svc.update(a.id, { slug: 'acme' })).updated).toBe(true)
    })

    it('returns LIBRARY_NOT_FOUND for an unknown id', async () => {
      expect((await new TenantAdminService(db).update('nope', { name: 'x' })).error).toBe(
        'LIBRARY_NOT_FOUND',
      )
    })
  })

  describe('delete', () => {
    it('deletes an empty library', async () => {
      const svc = new TenantAdminService(db)
      const { id } = await svc.create({ name: 'Empty', emailDomains: ['@e.com'] })
      expect(await svc.delete(id)).toEqual({ deleted: true })
      expect((await svc.listAll()).find((l) => l.id === id)).toBeUndefined()
    })

    it('refuses to delete a library that still has members or books', async () => {
      const svc = new TenantAdminService(db)
      const { id } = await svc.create({ name: 'Busy', emailDomains: ['@busy.com'] })
      await seedBook(db, 'b1', id)
      expect((await svc.delete(id)).error).toBe('LIBRARY_NOT_EMPTY')

      const { id: id2 } = await svc.create({ name: 'HasUsers', emailDomains: ['@u.com'] })
      await seedUser(db, 'member-1', id2)
      expect((await svc.delete(id2)).error).toBe('LIBRARY_NOT_EMPTY')
    })

    it('returns LIBRARY_NOT_FOUND for an unknown id', async () => {
      expect((await new TenantAdminService(db).delete('nope')).error).toBe('LIBRARY_NOT_FOUND')
    })
  })
})
