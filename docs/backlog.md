# Product Backlog

Running backlog of candidate features for OpenBookCorner, beyond the current specs
(`.kiro/specs/`). Items are mapped against what's already built and prioritized.

> **Competitor reference — 番薯借阅 (Fanshu Jieyue), fanshujieyue.com** (云阁(上海)信息科技,
> launched 2019-05): an **institutional library-management SaaS** ("书馆运营管理移动解决方案")
> for company/kids-picture-book/bookstore/community libraries (not a personal rental app). Mapped
> from its **verified** feature set (user-confirmed + official site fanshujieyue.com).
> Positioning: 信息化/移动化/智能化/云服务. Selling points: 免安装(扫码即用)、免设备(手机运营,
> 省电脑+扫码枪)、省人力(扫码录书/借阅)、全流程自动提醒、嵌入公众号/企业微信、私有化部署+专属小程序
> +微信支付. WeChat Mini Program (admin + reader editions) + web; self-built **20M+ Chinese ISBN DB**.
> Verified system auto-reminders: 逾期、荐购到馆、入馆申请、权限变更、订单更新、一键催还.
> Customer segments: 职工书屋、童书馆、书店、社区书馆. (Real customer request on their site:
> **批量操作 — batch move-to-shelf** for hundreds/thousands of books.)

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
| 到馆通知 (notify when a borrowed book becomes available) | ⬜ gap = availability subscription (R6) |
| 系统自动提醒 (入馆申请/权限变更/订单更新/一键催还) | ⬜ gap = notification matrix (B16 + R4) |
| 批量操作 (e.g. 批量转移书架 — customer-requested) | ⬜ gap (B21) |
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
| B21 | **Batch admin operations** (e.g. 批量转移书架, bulk edit/category/delete) | Real 番薯 customer pain: moving hundreds of books one-by-one; essential at scale | S | Med |
| B22 | **Photo → AI vision metadata fallback** | Robust answer to the "no stable/free CN ISBN provider" problem: photograph the cover, a vision model drafts title/author/publisher. See design note below. | M | **High (later)** |

## Cross-cutting polish
- ⬜ Toasts / success + error feedback on borrow/return/add; loading & empty states; error boundaries
- ⬜ Background sync for queued offline borrow/return (PWA stretch)

## Deferred — Phase 2 (WeChat / China), per ADR 0001
- ⬜ WeChat OAuth login (scan QR → authorized identity)
- ⬜ WeChat JS-SDK `wx.scanCode` for in-WebView ISBN scanning
- ⬜ ICP filing + migrate interactive path/DB to in-China host (Tencent CloudBase)
- ⬜ Possible WeChat Mini Program front end

## Prioritized roadmap

Ranked by **value × effort × dependency**. Each priority band is a shippable theme.
(Effort: S≈½–1 day, M≈2–4 days.)

### P0 — Do now (core gaps that unblock the product's purpose)
| Item | Rationale | Effort |
|------|-----------|--------|
| **B1 Chinese ISBN provider** (keyed, in resolver chain) | Confirmed prod gap (`resolvedBy: none` for CN ISBNs); 番薯's whole edge is its CN ISBN DB. Small, isolated, no-key-no-op. | S |
| **B3 Multiple copies per book** | Foundational data-model fix; blocks realistic circulation, reservations (B13), and stocktaking (B5). Do before more circulation features. | M |
| **B2 Scan-to-borrow / return** | 番薯's signature "手机运营书馆" UX; reuses the scanner we already have. | M |

### P1 — Next (circulation depth + engagement; most are existing specs)
| Item | Rationale | Effort |
|------|-----------|--------|
| **B13 Reservations / holds** (预约) + 到馆通知 | High-demand borrower feature; depends on B3. | M |
| **B4 Renewals / self-extension** (续借) | Quick win; `allowExtensions` already in settings. | S |
| **R6 Ratings & reviews** (+ 书评 replies) | Engagement; builds on the detail page; strong demo. | M |
| **R6 Book requests** (荐购) + 到馆提醒 | Direct 番薯 parity; grows the collection by demand. | M |
| **B15 Borrowing history + holds lists** | Completes "My Books" (在借/预约/历史). | S |

### P2 — Then (automation, admin ops, tenant management)
| Item | Rationale | Effort |
|------|-----------|--------|
| **R3 Email notifications + B16 reminders/一键催还** | Real automation (Cron + Cloudflare Email); 番薯 reminder matrix. | M |
| **R4 Librarian role assignment** + membership flow (入馆申请/权限变更) | Multi-admin orgs; notification matrix. | M |
| **B21 Batch admin operations** (批量转移书架/bulk edit) | Real 番薯 customer pain at scale. | S |
| **B10 Admin analytics dashboard** | Operational insight (借阅趋势/热门书/活跃用户). | M |
| **B11 Member self-registration & self-service** | Removes manual user seeding. | S |
| **Cross-cutting polish** (toasts, loading/empty states, error boundaries) | Perceived quality; cheap. | S |

### P3 — Later (nice-to-have, niche, or heavy infra)
| Item | Rationale | Effort |
|------|-----------|--------|
| **B17 Activity feed** (馆内动态) | Community feel; after reviews/requests exist to populate it. | M |
| **B18 Favorites + share** (poster/link) | Most valuable inside WeChat (Phase 2). | S |
| **B5 Inventory stocktaking** / **B6 shelf location & multi-branch** | Larger libraries; needs B3 + location model. | M |
| **B14 Order-mode & admin-proxy borrow** | Only if a tenant needs configurable flows. | M |
| **B19 Library-defined categories** / **B20 onboarding wizard** | Admin convenience. | S |
| **B8 Reading stats** / **B9 recommendations** / **B12 audit log** / **B7 fines** | Engagement/governance extras. | S–M |
| **R4 Super-admin tenant dashboard** | Needed to scale to many tenants (currently manual seed). | M |

### Deferred — Phase 2 (WeChat / China), per ADR 0001
WeChat OAuth login, `wx.scanCode` scanning, ICP filing + Tencent/CloudBase migration,
Mini Program front end. Gated on the hosting decision — do not start until committed.

> **Immediate recommendation:** ship **P0** as the next PR train (B1 → B3 → B2), since B3
> unblocks B13/B5 and B1 is a fast, isolated win that fixes the CN-metadata gap you hit.

## Design note — B22: Photo → AI vision metadata fallback

**Problem.** Free ISBN providers (Open Library, Google Books) have poor mainland-Chinese
coverage, and there is no stable *free* CN ISBN API (keyed CN providers = B1). For books
that resolve to nothing — common for CN titles — we want a last-resort that doesn't depend
on any ISBN database existing.

**Approach (preferred): on-Worker vision model via Cloudflare Workers AI.**
- Librarian photographs the **book cover** (reuse the existing camera UI).
- The image is sent to a **vision-capable model through the Cloudflare `AI` binding**
  (`env.AI.run(<vision-model>, { image, prompt })`) — runs inside our Worker, **no external
  API key**, aligns with ADR Phase 1, generous Workers AI free allocation.
- The model returns a **draft** `{ title, author, publisher?, publishedYear? }` (and ISBN if
  legible), which **pre-fills the editable** Add Book fields. Chinese covers read well with
  modern VLMs (and an external **Qwen-VL/Gemini** model can be added later behind an env key
  for even better CJK accuracy).

**Chain position (last fallback):**
```
scan ISBN → Open Library / Google Books → (B1 keyed CN ISBN API) → [B22] photo + AI vision → manual entry
```

**Guardrails (important):**
- **Human-in-the-loop:** AI output is a *draft the librarian confirms*; fields stay editable.
  Never auto-save AI metadata as authoritative. This bounds hallucination risk.
- **Fallback only:** invoke the vision call **only** when ISBN lookups return `none`
  (cost + latency are higher than a REST lookup; don't put it on the default path).
- **ISBN still wins** when a barcode resolves in a DB — that's authoritative.
- Reuse the `resolvedBy` telemetry: log `resolvedBy: "ai-vision"` for observability.

**Open questions for implementation:**
1. Workers AI model choice (on-Worker, free) vs. env-gated external VLM (Qwen-VL/Gemini,
   better CJK) — start with Workers AI, allow upgrade.
2. Standalone "add by photo" entry point, or purely a fallback in the lookup chain.

**Status:** documented now, to be implemented later (not in the current PR train).
