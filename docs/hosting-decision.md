# Hosting & Platform Decision

Status: Accepted (phased)
Date: 2026-10-16

## Context

OpenBookCorner is a multi-tenant library management app. A new requirement emerged:
some users are in **China** and may log in by **scanning a QR code with WeChat**
(WeChat OAuth web login), with possible deeper WeChat integration — and eventually a
WeChat Mini Program — later.

This raised the question of where to host, since the original spec targets Cloudflare.

## Decision

Adopt a **phased approach**, prioritizing simplicity first:

### Phase 1 — Cloudflare, simplest possible (current target)
- **Hosting**: Cloudflare (Pages + Workers), leveraging the generous free tier.
- **Database/Storage**: Cloudflare D1, KV, R2 (as in the original spec).
- **Authentication**: Simple **email / password** (or email verification code) — the
  simplest option. No WeChat, no external identity providers yet.
- **Goal**: Validate the core circulation loop (Release 1 MVP) with minimal moving parts
  and $0 hosting.

### Phase 2 — Add WeChat integration (later)
- Add **WeChat OAuth web login** (scan QR in WeChat → authorized identity → logged in).
- This introduces China-specific constraints:
  - WeChat OAuth `redirect_uri` and JS-SDK secure domains must be **ICP-filed** and
    whitelisted — Cloudflare domains generally cannot be ICP-filed.
  - Cross-border latency to Cloudflare from mainland China is poor on the interactive path.
  - ISBN barcode scanning inside the WeChat WebView needs **WeChat JS-SDK** (`wx.scanCode`),
    not the raw Camera API.
- Likely requires relocating the **interactive/auth path + DB** to an in-China,
  ICP-filed host (e.g., **Tencent CloudBase** — native WeChat sign-in, Postgres + RLS),
  while optionally keeping **Cloudflare's free tier for async/background work**
  (cron overdue checks, email, Open Library lookups, static/cover assets).
- Account model change: link WeChat `openid`/`unionid` to users; solve tenant assignment
  via email-domain binding and/or tenant-scoped invite QR codes.

### Phase 3 — Possible WeChat Mini Program (future)
- If deeper WeChat-native UX is desired, consider a Mini Program (e.g., via uni-app/Taro,
  or CloudBase-backed), which gives first-class `wx.login` and `wx.scanCode`.
- Trade-off: separate frontend paradigm and WeChat-only distribution.

## Rationale

- Phase 1 keeps the first release as simple and cheap as possible, matching the MVP's
  "architectural correctness over feature richness" principle.
- Deferring WeChat avoids ICP filing, Official Account registration, and China hosting
  costs until the core product is validated.
- The tRPC + Drizzle design is portable: Drizzle works with both Cloudflare D1 (Phase 1)
  and Postgres/CloudBase (Phase 2), so the data layer survives the migration.

## Consequences / Open Questions

- Phase 2 will require an **ICP filing** and a **WeChat Official Account / Open Platform**
  registration — these are gatekeepers to confirm before committing to the WeChat path.
- Phase 1's email/password auth differs from the original spec's email-verification-only
  flow; the spec's `tech`/`structure` steering docs may need a note about the phased auth.
- A later migration off Cloudflare for the interactive path should be planned so Phase 1
  choices don't hard-couple to D1-only features.

## Alternatives Considered

- **All-Cloudflare, including WeChat**: rejected for Phase 2+ (ICP filing + latency).
- **All-Tencent CloudBase from day one**: viable and WeChat-native, but adds cost/complexity
  before the MVP is validated; smaller/less durable free tier than Cloudflare.
- **WorkBuddy (Tencent AI app builder)**: it is a paid AI generation tool (not hosting;
  apps it generates run on CloudBase). Not a fit for this detailed, spec-driven project.
- **Next.js / T3 / TanStack Start / React Native / uni-app**: evaluated; stack choice is
  secondary to the hosting/distribution decision above and can be revisited per phase.
