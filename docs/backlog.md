# Product Backlog

Running backlog of candidate features for OpenBookCorner, beyond the current specs
(`.kiro/specs/`). Items are mapped against what's already built and prioritized.

> **Competitor reference — 番薯借阅 (Fanshu Jieyue), fanshujieyue.com** (云阁(上海)信息科技,
> launched 2019-05): an **institutional library-management SaaS** for company/kids-picture-book/
> community libraries (not a personal rental app). The "competitive scan" items below are mapped
> from its **verified** feature set (user-confirmed). Key traits: WeChat Mini Program (admin + reader
> editions) + web; no install, scan-to-use; embeddable in 公众号 / 企业微信; private deployment +
> white-label + WeChat Pay; a self-built **20M+ Chinese ISBN database** for scan-to-catalog.

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

## 番薯借阅 feature parity — gap analysis

How we compare to 番薯借阅's verified features (✅ have · 🟡 partial · ⬜ gap):

| 番薯借阅 feature | OpenBookCorner status |
|---|---|
| 搜索查询 (title/author/ISBN, details, status, 索书位置) | ✅ search; ✅ details/status · ⬜ shelf location (B6) |
| 扫码自助借还 (reader scan self-service) | ⬜ gap (B2) — we have scan-for-add only |
| 订单模式借还 / 管理员代借代还 (order mode / admin-proxy) | ⬜ gap (B14) |
| 借书/还书 | ✅ |
| 预约 (reserve/hold + 到馆提醒) | ⬜ gap (B13) |
| 续借 (self-renew, days set by library) | 🟡 `allowExtensions` setting exists, unused (B4) |
| 借阅记录 (在借/预约/历史) | 🟡 "My Books" shows active; ⬜ history/holds lists (B15) |
| 逾期管理 (还书前3天 + 逾期提醒, 一键催还) | 🟡 overdue view + contact ✅; ⬜ reminders + one-click nudge (R3 + B16) |
| 荐购 (reader purchase suggestion + 到馆提醒) | ⬜ gap = Book Requests (R6) |
| 书评社区 (notes, 摘抄, reply/like/share) | ⬜ gap = Ratings & Reviews + comments (R6, extend) |
| 馆内动态信息流 (borrow/荐购/书单/上架 feed) | ⬜ gap (B17) |
| 收藏 / 分享 (friend/link/poster) | ⬜ gap (B18) |
| 扫码自动识别录书 (20M+ ISBN DB) | 🟡 scan+lookup ✅; ⬜ Chinese coverage (B1) |
| 自定义图书分类 | 🟡 subjects captured; ⬜ library-defined categories (B19) |
| 会员管理 (入馆/权限变更通知/入馆申请) | 🟡 roles exist; ⬜ membership flow + notifications (R4 + B11) |
| 开馆5步向导 (create→config→catalog→readers→circulate) | ⬜ onboarding wizard (B20) |
| 微信小程序 (admin+reader) / 公众号 / 企业微信 嵌入 | ⬜ Phase 2 (WeChat) |
| 私有化部署 / 白标 / 微信支付 | ⬜ Phase 2 / future |

## New candidates (prioritized)

| # | Feature | Why it matters | Effort | Priority |
|---|---------|----------------|--------|----------|
| B1 | **Chinese ISBN provider** (data.isbn.work / jisu, behind an env key) in the metadata resolver chain | Both free providers return `none` for mainland-CN ISBNs (confirmed in prod logs for 9787568922579). 番薯's edge is its 20M+ CN ISBN DB — we close the gap via a keyed CN API | S | **High** |
| B2 | **Scan-to-borrow / scan-to-return** (reader self-service) | 番薯's core daily UX ("一部手机运营书馆"); reuse our scanner for circulation, not just Add Book | M | **High** |
| B3 | **Multiple copies per book** (quantity + available count) | Real libraries stock N copies; today a book is a single unit (`isAvailable` bool) | M | **High** |
| B13 | **Reservations / holds** (预约) + arrival reminder | 番薯core; lets readers queue for borrowed books | M | **High** |
| B4 | **Renewals / self-extension** (续借), days set by library | `allowExtensions` setting exists but unused; 番薯 self-renew | S | Med |
| B15 | **Borrowing history + holds lists** (在借/预约/历史) | "My Books" only shows active loans today | S | Med |
| B16 | **Due reminders + one-click nudge** (催还) | Pairs with R3 email; 番薯 reminds 3 days before + overdue | M | Med |
| B17 | **Library activity feed** (动态信息流: borrows, 荐购, 书单, new arrivals) | 番薯community feel; drives engagement | M | Med |
| B18 | **Favorites + share** (收藏/分享 friend/link/poster) | Discovery + viral sharing (poster is very WeChat-native) | S | Med |
| B14 | **Order-mode & admin proxy borrow/return** (订单模式 / 代借代还) | 番薯 configurable per-library circulation flows | M | Low |
| B19 | **Library-defined categories** | 番薯 custom classification; we only have Open-Library subjects | S | Low |
| B20 | **Open-a-library onboarding wizard** (5-step) | 番薯's guided setup lowers admin friction | S | Low |
| B5 | **Inventory stocktaking** (扫码盘点) | Scan shelves to reconcile present/missing | M | Med |
| B6 | **Shelf location / multi-branch** (索书位置 / 排架 / 分馆) | 番薯shows 索书位置; multi-site orgs | M | Med |
| B8 | **Reading stats / leaderboards** | Engagement/gamification | M | Low |
| B10 | **Admin analytics dashboard** (借阅趋势、热门书、活跃用户) | Operational insight | M | Med |
| B11 | **Member self-registration & account self-service** | Users are seeded/manual today | S | Med |
| B12 | **Audit log** (借还/管理操作日志) | Traceability for multi-admin tenants | S | Low |
| B7 | **Overdue fines** (罚金), optional/policy-driven | Return discipline where desired | S | Low |
| B9 | **Recommendations** (by history / subjects) | Discovery; leverages subjects metadata | M | Low |

## Cross-cutting polish
- ⬜ Toasts / success + error feedback on borrow/return/add; loading & empty states; error boundaries
- ⬜ Background sync for queued offline borrow/return (PWA stretch)

## Deferred — Phase 2 (WeChat / China), per ADR 0001
- ⬜ WeChat OAuth login (scan QR → authorized identity)
- ⬜ WeChat JS-SDK `wx.scanCode` for in-WebView ISBN scanning
- ⬜ ICP filing + migrate interactive path/DB to in-China host (Tencent CloudBase)
- ⬜ Possible WeChat Mini Program front end

## Suggested next sequence
1. **B1 Chinese ISBN provider** — closes the metadata gap vs 番薯's 20M CN ISBN DB; highest value for a CN collection.
2. **B2 scan-to-borrow + B3 multiple copies** — the core "一部手机运营书馆" circulation UX.
3. **B13 reservations/holds + R6 ratings/reviews + 荐购(book requests)** — 番薯's community/engagement layer (builds on the detail page).
4. **R3 email notifications + B16 reminders/一键催还** — automation (needs Cron + Cloudflare Email).
