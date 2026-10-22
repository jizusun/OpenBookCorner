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

  describe('sendVerificationCode — English (default)', () => {
    it('sends with correct from/to/subject params', async () => {
      const svc = new EmailService('re_test_key', 'noreply@test.com')
      await svc.sendVerificationCode('user@example.com', '123456', 'Acme Library', 'en')

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

    it('includes the library name in subject and body', async () => {
      const svc = new EmailService('re_test_key', 'noreply@test.com')
      await svc.sendVerificationCode('user@example.com', '654321', 'My Library', 'en')

      const instance = MockResend.mock.results[0]!.value
      const call = instance.emails.send.mock.calls[0]![0] as { html: string; subject: string }
      expect(call.subject).toContain('My Library')
      expect(call.html).toContain('My Library')
    })

    it('includes the admin contact email in the body', async () => {
      const svc = new EmailService('re_test_key', 'noreply@test.com')
      await svc.sendVerificationCode('user@example.com', '000003', 'Acme Library', 'en', 'admin@acme.com')

      const instance = MockResend.mock.results[0]!.value
      const call = instance.emails.send.mock.calls[0]![0] as { html: string }
      expect(call.html).toContain('admin@acme.com')
    })

    it('mentions OpenBookCorner as the sending system', async () => {
      const svc = new EmailService('re_test_key', 'noreply@test.com')
      await svc.sendVerificationCode('user@example.com', '000001', 'Acme Library', 'en')

      const instance = MockResend.mock.results[0]!.value
      const call = instance.emails.send.mock.calls[0]![0] as { html: string }
      expect(call.html).toContain('OpenBookCorner')
    })

    it('mentions the admin is sending on behalf of the library', async () => {
      const svc = new EmailService('re_test_key', 'noreply@test.com')
      await svc.sendVerificationCode('user@example.com', '000002', 'Acme Library', 'en')

      const instance = MockResend.mock.results[0]!.value
      const call = instance.emails.send.mock.calls[0]![0] as { html: string }
      // Should mention the library admin / sent on behalf of
      expect(call.html).toMatch(/behalf|admin|Acme Library/i)
    })
  })

  describe('sendVerificationCode — Chinese (zh)', () => {
    it('sends a Chinese subject when locale is zh', async () => {
      const svc = new EmailService('re_test_key', 'noreply@test.com')
      await svc.sendVerificationCode('user@example.com', '888888', '书香图书馆', 'zh')

      const instance = MockResend.mock.results[0]!.value
      const call = instance.emails.send.mock.calls[0]![0] as { html: string; subject: string }
      expect(call.subject).toContain('888888')
      expect(call.subject).toContain('书香图书馆')
      // Subject should be Chinese
      expect(call.subject).toMatch(/验证码|验证/)
      expect(call.html).toContain('书香图书馆')
      expect(call.html).toContain('OpenBookCorner')
    })

    it('falls back to English for unknown locale', async () => {
      const svc = new EmailService('re_test_key', 'noreply@test.com')
      await svc.sendVerificationCode('user@example.com', '111111', 'Lib', 'fr')

      const instance = MockResend.mock.results[0]!.value
      const call = instance.emails.send.mock.calls[0]![0] as { subject: string }
      // Should fall back to English subject pattern
      expect(call.subject).toContain('111111')
      expect(call.subject).not.toMatch(/验证码/)
    })
  })

  it('is a no-op when API key is missing', async () => {
    const svc = new EmailService(undefined, 'noreply@test.com')
    await expect(svc.sendVerificationCode('user@example.com', '000000', 'Lib', 'en')).resolves.toBeUndefined()
    expect(MockResend).not.toHaveBeenCalled()
  })
  it('generates a 6-digit numeric code via generateCode()', () => {
    const code = EmailService.generateCode()
    expect(code).toMatch(/^\d{6}$/)
  })

  it('generates different codes on each call', () => {
    const codes = new Set(Array.from({ length: 10 }, () => EmailService.generateCode()))
    expect(codes.size).toBeGreaterThan(1)
  })
})
