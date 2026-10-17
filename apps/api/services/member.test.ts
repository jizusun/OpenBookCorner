import { describe, it, expect, beforeEach } from 'vitest'
import { MemberService } from './index'
import { createTestDb, seedLibrary, seedMember, type Db } from '@obc/db/testing'
import { members } from '@obc/db'

const LIB = 'lib-a'

let db: Db
beforeEach(async () => {
  db = await createTestDb()
  await seedLibrary(db, LIB)
})

async function mk(
  id: string,
  opts: {
    name: string
    role?: 'library_admin' | 'library_reader'
    plan?: string
    phone?: string
    memberNo?: string
    joinedAt?: string
    borrowedCount?: number
  },
) {
  await db.insert(members).values({
    id,
    libraryId: LIB,
    name: opts.name,
    role: opts.role ?? 'library_reader',
    membershipPlan: opts.plan ?? null,
    phone: opts.phone ?? null,
    memberNo: opts.memberNo ?? null,
    joinedAt: opts.joinedAt ?? null,
    borrowedCount: opts.borrowedCount ?? null,
    source: 'fanshu-import',
    createdAt: new Date().toISOString(),
  })
}

describe('MemberService', () => {
  it('lists tenant members, searchable by name/phone/会员号', async () => {
    await mk('m1', { name: 'Alice', phone: '13800000000', memberNo: 'I1' })
    await mk('m2', { name: 'Bob', phone: '13900000000', memberNo: 'I2' })
    const svc = new MemberService(db)

    expect((await svc.listByLibrary(LIB)).total).toBe(2)
    expect((await svc.listByLibrary(LIB, { search: 'Alice' })).items.map((m) => m.id)).toEqual(['m1'])
    expect((await svc.listByLibrary(LIB, { search: '13900' })).items.map((m) => m.id)).toEqual(['m2'])
    expect((await svc.listByLibrary(LIB, { search: 'I1' })).items.map((m) => m.id)).toEqual(['m1'])
  })

  it('sorts by name/joinedAt and filters by role + plan', async () => {
    await mk('a', { name: 'Zoe', role: 'library_admin', plan: '借阅卡', joinedAt: '2020-01-01' })
    await mk('b', { name: 'Amy', role: 'library_reader', plan: '借阅卡', joinedAt: '2022-01-01' })
    await mk('c', { name: 'Max', role: 'library_reader', plan: '月卡', joinedAt: '2021-01-01' })
    const svc = new MemberService(db)

    // name asc
    expect((await svc.listByLibrary(LIB, { sortBy: 'name', sortDir: 'asc' })).items.map((m) => m.name)).toEqual(['Amy', 'Max', 'Zoe'])
    // joinedAt desc
    expect((await svc.listByLibrary(LIB, { sortBy: 'joinedAt', sortDir: 'desc' })).items.map((m) => m.id)).toEqual(['b', 'c', 'a'])
    // filter role
    expect((await svc.listByLibrary(LIB, { role: 'library_admin' })).items.map((m) => m.id)).toEqual(['a'])
    // filter plan
    expect((await svc.listByLibrary(LIB, { plan: '借阅卡' })).items.map((m) => m.id).sort()).toEqual(['a', 'b'])
  })

  it('facets returns distinct membership plans', async () => {
    await mk('a', { name: 'A', plan: '借阅卡' })
    await mk('b', { name: 'B', plan: '月卡' })
    await mk('c', { name: 'C', plan: '借阅卡' })
    const facets = await new MemberService(db).listFacets(LIB)
    expect(facets.plans).toEqual(['借阅卡', '月卡'])
  })

  it('getById is tenant-scoped', async () => {
    await mk('m1', { name: 'Alice' })
    const svc = new MemberService(db)
    expect((await svc.getById('m1', LIB))?.name).toBe('Alice')
    expect(await svc.getById('m1', 'other-lib')).toBeNull()
    expect(await svc.getById('nope', LIB)).toBeNull()
  })
})
