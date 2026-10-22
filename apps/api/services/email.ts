import { Resend } from 'resend'

/**
 * Transactional email service via Resend (ADR 0009 Phase 2).
 * When RESEND_API_KEY is absent (local dev, CI without key) this is a no-op
 * so the worker still boots and non-email flows keep working.
 */
export class EmailService {
  private client: Resend | null

  constructor(
    private readonly apiKey: string | undefined,
    private readonly from: string,
  ) {
    this.client = apiKey ? new Resend(apiKey) : null
  }

  /**
   * Send a 6-digit verification code to a join-form email field.
   * Subject and body include the code prominently for easy copy-paste.
   */
  async sendVerificationCode(
    to: string,
    code: string,
    libraryName: string,
  ): Promise<void> {
    if (!this.client) {
      // No API key — silent no-op in dev / CI.
      return
    }
    const subject = `${code} — Your verification code for ${libraryName}`
    const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
  <h2 style="margin-bottom:8px">Verify your email</h2>
  <p>You're joining <strong>${libraryName}</strong>. Enter the code below to confirm your email address.</p>
  <div style="font-size:36px;font-weight:700;letter-spacing:8px;padding:24px;background:#f4f4f5;border-radius:8px;text-align:center;margin:24px 0">
    ${code}
  </div>
  <p style="color:#666;font-size:14px">This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
  <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0">
  <p style="color:#999;font-size:12px">Sent by OpenBookCorner on behalf of ${libraryName}</p>
</body>
</html>`

    await this.client.emails.send({
      from: this.from,
      to: [to],
      subject,
      html,
    })
  }

  /** Generate a cryptographically random 6-digit code. */
  static generateCode(): string {
    const array = new Uint32Array(1)
    crypto.getRandomValues(array)
    return String(array[0]! % 1_000_000).padStart(6, '0')
  }
}
