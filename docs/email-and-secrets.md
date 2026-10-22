# Email (Resend) & Secrets Management

## Overview

OpenBookCorner uses [Resend](https://resend.com) to send transactional email — currently for OTP
verification codes on join-form `verifyEmail` fields. This document explains how Resend is
integrated, how secrets are managed across environments, and the rules for adding new secrets.

---

## Resend Integration

### What it does

When a library admin configures a join-form field with `verifyEmail: true`, members filling out
that field must verify email ownership before they can submit the form:

1. Member fills in their email address in the join form field.
2. Clicks **Send verification code** → `POST /api/join/send-verification`.
3. Worker generates a 6-digit OTP, stores it in the `verification` table (10-minute TTL), and
   calls Resend to send an email from `noreply@jizu.dev`.
4. Member receives the email, enters the code, clicks **Verify** → `POST /api/join/verify-email`.
5. Code matches → field is marked verified in the client. Wrong/expired → error shown.
6. All `verifyEmail` fields must be verified before the **Join library** button submits.

### Sender domain

`jizu.dev` is verified on Resend. DNS records were added to Cloudflare via the `cf` CLI:

| Type  | Name                    | Value                                      |
|-------|-------------------------|--------------------------------------------|
| TXT   | `resend._domainkey`     | DKIM public key                            |
| MX    | `send`                  | `feedback-smtp.us-east-1.amazonses.com`    |
| TXT   | `send`                  | `v=spf1 include:amazonses.com ~all`        |
| CNAME | `rsend`                 | `send.forge.rmta.net`                      |

The domain ID in Resend is `544d35fd-16f1-4005-8feb-58ffb89a6c7c`.

### No-op fallback

`EmailService` is instantiated with `RESEND_API_KEY` from the Worker environment. When the key is
absent (e.g. a cold CI run without secrets) the service is a **no-op** — it does not throw. The
worker still boots and all non-email flows keep working.

---

## API Keys

Three **sending-only** Resend keys exist — one per environment. Sending-only keys cannot manage
domains or other keys, limiting blast radius if one leaks.

| Key name           | Environment         | Scope          |
|--------------------|---------------------|----------------|
| `obc-production`   | Production Worker   | Sending access |
| `obc-preview`      | CF Preview / CI     | Sending access |
| `obc-local`        | Local development   | Sending access |

Keys are scoped to the `jizu.dev` domain so they can only send from `*@jizu.dev`.

> **Rotating a key**: create a new sending key on [resend.com/api-keys](https://resend.com/api-keys),
> update it in the target environment (see below), delete the old key.

---

## Secrets Management — One Rule

> **Secrets MUST NOT appear in any committed file.** Not in source code, not in
> `wrangler.jsonc`, not in workflow YAML, not in `.env.example`. Never.

`wrangler.jsonc` `vars:` is for **non-secret** runtime config only:
`ENVIRONMENT`, `APP_ORIGIN`, `RESEND_FROM`. API keys always go in secrets.

---

## Per-Environment Storage

### 1. Production — Cloudflare Worker secret

Set once via the `cf` CLI (requires account auth):

```bash
cf workers secrets update RESEND_API_KEY \
  --worker openbookcorner \
  --text "re_..." \
  --type secret_text
```

To verify it is set:

```bash
cf workers secrets list --worker openbookcorner
```

### 2. Cloudflare Preview (CI) — GitHub Actions secret → wrangler-action injection

The **preview Worker** receives secrets during each CI deploy via the
`cloudflare/wrangler-action` `secrets:` block in `.github/workflows/preview.yml`:

```yaml
- name: Deploy the shared Preview
  uses: cloudflare/wrangler-action@v4
  with:
    command: preview --name preview
    secrets: |
      RESEND_API_KEY        # ← injected into the preview Worker's secret store
  env:
    RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}   # ← sourced from GH secret
```

The GitHub Actions secret is set once:

```bash
echo "re_..." | gh secret set RESEND_API_KEY
```

To list current GH secrets:

```bash
gh secret list
```

> This is equivalent to `wrangler preview base-config secret put RESEND_API_KEY` — the
> wrangler-action calls the same Cloudflare Previews API during each deploy.

### 3. Local development — `.dev.vars` (gitignored)

Create `apps/app/.dev.vars` (never commit this file — it is covered by the root `.gitignore`):

```bash
# apps/app/.dev.vars
RESEND_API_KEY=re_...
RESEND_FROM=noreply@jizu.dev
```

The root `.gitignore` contains `.dev.vars` so it is ignored everywhere in the monorepo.
`preview-refresh.sh` passes `--var ENVIRONMENT:development` at startup so the worker correctly
shows demo accounts on the login page.

---

## Adding a New Secret

1. **Generate** the secret value (API key, token, etc.).
2. **Set in production** via `cf workers secrets update`.
3. **Set in GitHub Actions** via `gh secret set SECRET_NAME`.
4. **Add to `preview.yml`** `secrets:` block and `env:` block (same pattern as `RESEND_API_KEY`).
5. **Add to `apps/api/lib/env.ts`** schema — use `z.string().optional()` unless truly required at
   boot, so the worker still starts during tests without the secret.
6. **Add to `apps/app/.dev.vars`** locally for development.
7. **Document** in this file and in the `AGENTS.md` secrets table.

---

## Resend Dashboard Links

- Sent emails: <https://resend.com/emails>
- API keys: <https://resend.com/api-keys>
- Domain status: <https://resend.com/domains>
