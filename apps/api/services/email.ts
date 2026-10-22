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
   * Send a 6-digit OTP for join-form email verification.
   *
   * @param to          Recipient email
   * @param code        6-digit OTP
   * @param libraryName Display name of the library the user is joining
   * @param locale      'zh' for Chinese, anything else falls back to English
   * @param adminEmail  Optional library admin email shown as contact
   */
  async sendVerificationCode(
    to: string,
    code: string,
    libraryName: string,
    locale: string = 'en',
    adminEmail?: string,
  ): Promise<void> {
    if (!this.client) return

    const isZh = locale === 'zh'
    const { subject, html } = isZh
      ? this.#buildZh(code, libraryName, adminEmail)
      : this.#buildEn(code, libraryName, adminEmail)

    await this.client.emails.send({
      from: this.from,
      to: [to],
      subject,
      html,
    })
  }

  #buildEn(code: string, libraryName: string, adminEmail?: string): { subject: string; html: string } {
    const subject = `${code} — Verification code for ${libraryName}`
    const adminLine = adminEmail
      ? `<p style="color:#555;font-size:13px">If you have questions, contact the library admin at <a href="mailto:${adminEmail}">${adminEmail}</a>.</p>`
      : ''
    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
  <p style="font-size:13px;color:#888;margin-bottom:16px">Sent by the admin of <strong>${libraryName}</strong> via OpenBookCorner</p>
  <h2 style="margin:0 0 8px">Verify your email address</h2>
  <p>You are joining <strong>${libraryName}</strong>. Enter the code below to confirm your email address.</p>
  <div style="font-size:40px;font-weight:700;letter-spacing:10px;padding:24px;background:#f4f4f5;border-radius:8px;text-align:center;margin:24px 0">
    ${code}
  </div>
  <p style="color:#666;font-size:14px">This code expires in <strong>10 minutes</strong>. If you did not request this, you can safely ignore this email.</p>
  ${adminLine}
  <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0">
  <p style="color:#aaa;font-size:12px">
    This message was sent by <strong>OpenBookCorner</strong> on behalf of the admin of <strong>${libraryName}</strong>.<br>
    OpenBookCorner is an open-source library management system.
  </p>
</body>
</html>`
    return { subject, html }
  }

  #buildZh(code: string, libraryName: string, adminEmail?: string): { subject: string; html: string } {
    const subject = `${code} — ${libraryName} 的邮箱验证码`
    const adminLine = adminEmail
      ? `<p style="color:#555;font-size:13px">如有疑问，请联系图书馆管理员：<a href="mailto:${adminEmail}">${adminEmail}</a></p>`
      : ''
    const html = `<!DOCTYPE html>
<html lang="zh">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
  <p style="font-size:13px;color:#888;margin-bottom:16px">由 <strong>${libraryName}</strong> 管理员通过 OpenBookCorner 发送</p>
  <h2 style="margin:0 0 8px">验证您的邮箱</h2>
  <p>您正在申请加入 <strong>${libraryName}</strong>。请填写下方验证码以确认邮箱所有权。</p>
  <div style="font-size:40px;font-weight:700;letter-spacing:10px;padding:24px;background:#f4f4f5;border-radius:8px;text-align:center;margin:24px 0">
    ${code}
  </div>
  <p style="color:#666;font-size:14px">验证码 <strong>10 分钟</strong>内有效。如非本人操作，请忽略此邮件。</p>
  ${adminLine}
  <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0">
  <p style="color:#aaa;font-size:12px">
    本邮件由 <strong>OpenBookCorner</strong> 代表 <strong>${libraryName}</strong> 管理员发送。<br>
    OpenBookCorner 是一个开源图书馆管理系统。
  </p>
</body>
</html>`
    return { subject, html }
  }

  /** Generate a cryptographically random 6-digit code. */
  static generateCode(): string {
    const array = new Uint32Array(1)
    crypto.getRandomValues(array)
    return String(array[0]! % 1_000_000).padStart(6, '0')
  }
}
