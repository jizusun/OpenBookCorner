import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb, seedLibrary, type Database } from '@obc/db/testing'
import { JoinFieldService } from './join-field'

let db: Database

beforeEach(async () => {
  db = await createTestDb()
  await seedLibrary(db, 'lib-a')
})

describe('JoinFieldService', () => {
  it('starts with no fields for a new library', async () => {
    expect(await new JoinFieldService(db).list('lib-a')).toHaveLength(0)
  })

  it('creates a field and lists it', async () => {
    const svc = new JoinFieldService(db)
    await svc.create('lib-a', { key: 'employee_no', label: '工号', type: 'text', required: true })
    const fields = await svc.list('lib-a')
    expect(fields).toHaveLength(1)
    expect(fields[0]!.key).toBe('employee_no')
    expect(fields[0]!.label).toBe('工号')
    expect(fields[0]!.required).toBe(true)
    expect(fields[0]!.verifyEmail).toBe(false)
  })

  it('assigns ascending positions so fields are ordered', async () => {
    const svc = new JoinFieldService(db)
    await svc.create('lib-a', { key: 'a', label: 'A', type: 'text' })
    await svc.create('lib-a', { key: 'b', label: 'B', type: 'email' })
    await svc.create('lib-a', { key: 'c', label: 'C', type: 'text' })
    const fields = await svc.list('lib-a')
    expect(fields.map((f) => f.key)).toEqual(['a', 'b', 'c'])
    expect(fields.map((f) => f.position)).toEqual([0, 1, 2])
  })

  it('creates an email field with verifyEmail=true', async () => {
    const svc = new JoinFieldService(db)
    await svc.create('lib-a', { key: 'company_email', label: '公司邮箱', type: 'email', verifyEmail: true })
    const fields = await svc.list('lib-a')
    expect(fields[0]!.verifyEmail).toBe(true)
    expect(fields[0]!.type).toBe('email')
  })

  it('updates a field label', async () => {
    const svc = new JoinFieldService(db)
    const field = await svc.create('lib-a', { key: 'dept', label: 'Department', type: 'text' })
    await svc.update(field.id, 'lib-a', { label: 'Department / Team' })
    const fields = await svc.list('lib-a')
    expect(fields[0]!.label).toBe('Department / Team')
  })

  it('removes a field', async () => {
    const svc = new JoinFieldService(db)
    const field = await svc.create('lib-a', { key: 'room_no', label: '房号', type: 'text' })
    await svc.remove(field.id, 'lib-a')
    expect(await svc.list('lib-a')).toHaveLength(0)
  })

  it('is library-scoped: fields from other libraries are not returned', async () => {
    await seedLibrary(db, 'lib-b')
    const svc = new JoinFieldService(db)
    await svc.create('lib-a', { key: 'a', label: 'A', type: 'text' })
    await svc.create('lib-b', { key: 'b', label: 'B', type: 'text' })
    expect(await svc.list('lib-a')).toHaveLength(1)
    expect(await svc.list('lib-b')).toHaveLength(1)
  })
})
