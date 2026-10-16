import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from './password'

describe('password hashing', () => {
  it('verifies a correct password', async () => {
    const hash = await hashPassword('correct horse battery staple')
    expect(await verifyPassword(hash, 'correct horse battery staple')).toBe(true)
  })

  it('produces a pbkdf2-formatted hash with salt (non-deterministic)', async () => {
    const a = await hashPassword('samePassword123')
    const b = await hashPassword('samePassword123')
    expect(a.startsWith('pbkdf2$')).toBe(true)
    expect(a).not.toBe(b) // random salt per hash
  })

  // --- Negation tests ---
  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('rightPassword1')
    expect(await verifyPassword(hash, 'wrongPassword1')).toBe(false)
  })

  it('rejects a tampered/garbage hash', async () => {
    expect(await verifyPassword('not-a-valid-hash', 'whatever')).toBe(false)
    expect(await verifyPassword('pbkdf2$100000$bad$bad', 'whatever')).toBe(false)
  })

  it('rejects empty password against a real hash', async () => {
    const hash = await hashPassword('nonEmptyPassword')
    expect(await verifyPassword(hash, '')).toBe(false)
  })
})
