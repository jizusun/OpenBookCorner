import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the resend module before importing EmailService
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: 'email-id-123' }, error: null }),
    },
  })),
}))

import { EmailService } from './email'
import { Resend } from 'resend'

const MockResend = vi.mocked(Resend)

describe('EmailService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends a verification code email with the correct params', async () => {
    const svc = new EmailService('re_test_key', 'noreply@test.com')
    await svc.sendVerificationCode('user@example.com', '123456', 'Acme Library')

    expect(MockResend).toHaveBeenCalledWith('re_test_key')
    const instance = MockResend.mock.results[0]!.value
    expect(instance.emails.send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'noreply@test.com',
        to: ['user@example.com'],
        subject: expect.stringContaining('123456'),
        html: expect.stringContaining('123456'),
      }),
    )
  })

  it('includes the library name in the email', async () => {
    const svc = new EmailService('re_test_key', 'noreply@test.com')
    await svc.sendVerificationCode('user@example.com', '654321', 'My Library')

    const instance = MockResend.mock.results[0]!.value
    const call = instance.emails.send.mock.calls[0]![0] as { html: string; subject: string }
    expect(call.html).toContain('My Library')
  })

  it('is a no-op when API key is missing (worker boots without email config)', async () => {
    const svc = new EmailService(undefined, 'noreply@test.com')
    // Should not throw, should not create a Resend client
    await expect(svc.sendVerificationCode('user@example.com', '000000', 'Lib')).resolves.toBeUndefined()
    expect(MockResend).not.toHaveBeenCalled()
  })

  it('generates a 6-digit numeric code via generateCode()', () => {
    const code = EmailService.generateCode()
    expect(code).toMatch(/^\d{6}$/)
  })

  it('generates different codes on each call (not constant)', () => {
    const codes = new Set(Array.from({ length: 10 }, () => EmailService.generateCode()))
    expect(codes.size).toBeGreaterThan(1)
  })
})
