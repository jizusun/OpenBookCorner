# Product Backlog

Running backlog of candidate features for OpenBookCorner, beyond the current specs
(`.kiro/specs/`). Items are mapped against what's already built and prioritized.

> **Source note:** The "competitive scan" items below are **derived from comparable
> WeChat-based shared/company library mini-programs** (e.g. 流动图书馆, 图书盒子Pro,
> SLALib, and common WeChat 图书借阅 templates). We could **not** verify the exact
> feature list of **番薯借阅 (Fanshu Jieyue)** from public sources, so these reflect the
> product *category*, not that specific product. Replace/confirm if an authoritative
> 番薯借阅 feature page becomes available.

## Legend
- ✅ Done · 🟡 Partial · ⬜ Not started · (R#) maps to an existing release spec

## Already shipped / in progress
- ✅ Multi-tenant foundation, email/password auth, roles (R1)
- ✅ Catalog list + **search + pagination** (R1/R3)
- ✅ Borrow / return / "My Books" circulation loop (R1)
- ✅ Admin manual book entry (R1)
- ✅ **ISBN barcode scanning** for Add Book (R2) — web `BarcodeDetector`
- ✅ **Rich metadata** (publisher, year, cover, description, subjects) via multi-provider
  lookup (Open Library + Google Books) + **book detail / discovery page** (R2)
- ✅ **Overdue management** view with day-range filters + borrower contact (R2)
- ✅ Installable **PWA** + offline catalog/My Books (R5)
- 🟡 Observability: structured `isbn_lookup` logging (queryable via `cf o11y telemetry query`)

## Planned (existing specs)
- ⬜ Automated **email notifications** — due-date reminders + overdue notices (R3) · needs Cron + Email
- ⬜ **Super-admin tenant dashboard** — create/manage tenants (R4)
- ⬜ **Librarian role assignment** — promote/demote members (R4)
- ⬜ **Ratings & reviews** (R6)
- ⬜ **Book requests** (members request titles; librarians approve) (R6)
- ⬜ **Subscriptions & notifications** (new book / availability) (R6)

## New candidates (from competitive category scan)

| # | Feature | Why it matters | Effort | Priority |
|---|---------|----------------|--------|----------|
| B1 | **Chinese ISBN provider** (data.isbn.work / jisu, behind an env key) in the metadata resolver chain | Both free providers return `none` for mainland-CN ISBNs (confirmed in prod logs for 9787568922579); our corner is CN-heavy | S | **High** |
| B2 | **Scan-to-borrow / scan-to-return** | Reuse the camera scanner for the circulation loop, not just Add Book — the core "番薯"-style UX | M | **High** |
| B3 | **Multiple copies per book** (quantity + available count) | Real libraries stock N copies; today a book is a single borrowable unit (`isAvailable` bool) | M | **High** |
| B4 | **Renewals / extensions** (续借) with max-renewals policy | `allowExtensions` exists in library settings but is unused; common borrower need | S | Med |
| B5 | **Inventory stocktaking** (扫码盘点) | Admin scans shelves to reconcile present/missing/misplaced books | M | Med |
| B6 | **Shelf location / multi-branch** (排架 / 分馆) | Physical location per copy; multi-site orgs | M | Med |
| B7 | **Overdue fines** (罚金), policy-driven & optional | Enforce return discipline where desired | S | Low |
| B8 | **Reading stats / leaderboards** (阅读量/读书报告) | Engagement & gamification; community feel | M | Med |
| B9 | **Recommendations** (by borrow history / subjects) | Discovery; leverages the new subjects/metadata | M | Low |
| B10 | **Admin analytics dashboard** (借阅趋势、热门书、活跃用户) | Operational insight for librarians/super-admins | M | Med |
| B11 | **Member self-registration & account self-service** (change password, profile) | Users are seeded/manual today | S | Med |
| B12 | **Audit log** (借还/管理操作日志) | Traceability for multi-admin tenants | S | Low |

## Cross-cutting polish
- ⬜ Toasts / success + error feedback on borrow/return/add; loading & empty states; error boundaries
- ⬜ Background sync for queued offline borrow/return (PWA stretch)

## Deferred — Phase 2 (WeChat / China), per ADR 0001
- ⬜ WeChat OAuth login (scan QR → authorized identity)
- ⬜ WeChat JS-SDK `wx.scanCode` for in-WebView ISBN scanning
- ⬜ ICP filing + migrate interactive path/DB to in-China host (Tencent CloudBase)
- ⬜ Possible WeChat Mini Program front end

## Suggested next sequence
1. **B1 Chinese ISBN provider** — finishes the metadata story; highest value for a CN collection.
2. **Ratings & reviews (R6)** — high engagement, self-contained, builds on the detail page.
3. **B2 scan-to-borrow** + **B3 multiple copies** — rounds out the core "shared library" UX.
4. **Email notifications (R3)** — real automation (needs Cron + Cloudflare Email setup).
