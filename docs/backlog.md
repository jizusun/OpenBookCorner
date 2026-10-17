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

### China access latency — investigated 2026-10-17 (DEFERRED)
Users report the site is slow from mainland China. Investigated "优选 IP (preferred-IP)"
optimizations:
- **Why slow:** Cloudflare's free network has no in-China PoPs, so CN traffic hits
  overseas edges (US-west / SG). This is a cross-border link issue, not an app issue
  (app-side already optimized: instant inline loader, non-blocking fonts, vendor chunk
  splitting, route-transition progress bar, `intent` preload).
- **Preferred-IP via hosts:** only works per-device; user has no PC (phone only), so can't
  self-test or benefit at scale.
- **Preferred-IP via Cloudflare for SaaS** (custom hostname + Workers fallback origin + a
  DNS-only A record → preferred CF IP): the ONLY clean way to serve a preferred IP that
  still routes to our Worker. BUT: (1) requires enabling **SSL for SaaS** on the `jizu.dev`
  zone first — a Dashboard action, not doable via `cf`/API (zone returned `1456 … available
  with SSL for SaaS`); (2) SaaS custom-hostname → fallback origin that is itself on Cloudflare
  risks a **CF→CF double hop that can be *slower*** (community-reported); (3) requires ongoing
  manual preferred-IP maintenance (IPs rotate). With no way to measure the gain first (no PC),
  this is a likely-low/negative-ROI change — **deferred** per user ("暂缓").
- **Real fix = this section's Phase 2:** ICP filing + in-China host/CDN (Tencent CloudBase).
  That's the only reliably-effective path for China latency. Revisit preferred-IP only if a
  China-network device can first measure a real speedup via a `hosts` override.

## Prioritized roadmap

Re-prioritized **by 番薯借阅's interface logic** (the source-rated UI spec above). Ordering
follows the screens 番薯's real UI centers on, with **data-model prerequisites first**. Only
**evidence-backed【官网确认/截图·视频可见】** behaviors are scheduled; 【惯例推断】 items are not.
(Effort: S≈½–1 day, M≈2–4 days.)

### ✅ Shipped since last re-prioritization
- **B2 Scan-to-borrow by ISBN** · multi-provider ISBN metadata + R2 cover storage · overdue view
  · library settings · feedback · **Admin / Reader / System view switcher** · **super-admin tenant
  management** (partial R4) · catalog search/pagination/filters · My Books (default) · PWA + loader.

### P0 — Data model that unblocks 番薯's core screens (do first)
| Item | 番薯 UI it unblocks | Effort |
|------|--------------------|--------|
| **B3 Multiple copies / 可借数** (`quantity` + `availableCount`, replace `isAvailable` bool) | Detail page's 馆藏数/可借数/在借状态; reservations (can only reserve when 0 available); stocktaking | M |
| **B6 Shelf location (A01)** (per book/copy; show on detail + holds + catalog grouping) | Threads through **three** screens: detail, 预约卡片, admin 藏书 grouped by 书架 | S |

### P1 — Reader "borrow-code + reserve" loop (番薯's signature reader UI)
| Item | 番薯 UI evidence | Effort |
|------|------------------|--------|
| **B13 Reservations/holds** + **「距释放还有 X 天」** + 到馆通知 toggle | 【截图】"我→已预约图书"; detail 已借完→「到馆通知」 (needs B3) | M |
| **B2+ 生成借书码** (reader shows code → admin scans; self-borrow path) | 【截图】"我→已预约→生成借书码"; 【官网】扫码自助 | M |
| **B15 "我的" as lists** (我想读 / 在借 / 已归还 / 已预约) | 【截图】"我的" is clipboard-style lists | S |
| **B4 续借 (renew)** | 【官网】续借; `allowExtensions` setting already exists, unused | S |

### P2 — Admin "tool-backend" UI (番薯 management edition)
| Item | 番薯 UI evidence | Effort |
|------|------------------|--------|
| **Scan-queue cataloging** (camera + 选分类 + 「已扫 N 本 / 结束录书」 continuous) | 【视频】录书核心页 = 扫码框 + 卡片队列 | M |
| **B14 Admin proxy borrow/return in member detail** ("先找人→再扫书"; 还书 inline, not a page) | 【视频】成员→TA的借阅→还书/帮借 | M |
| **R4+B11 Member management** (list / 邀请新成员 invite-code / 入馆审核 / 子管理员) | 【视频】成员页 | M |
| **B16 一键催还** on the overdue list | 【视频】逾期名单 + 一键催还 | S |
| **B21 Batch ops** (批量转移书架 / bulk edit) | 【官方反馈】real pain at scale (needs B3/B6) | S |
| **B10 Analytics** (借阅趋势 / 热书榜 / 活跃用户) | 【官网】数据统计 | M |

### P3 — Community / discovery (番薯 reader "content flow")
| Item | 番薯 UI evidence | Effort |
|------|------------------|--------|
| **R6 Reviews 书评** (+ 点赞/回复) | 【官网】detail 书评区 | M |
| **R6 荐购 (purchase requests)** + 到馆通知 | 【官网】荐购清单 | M |
| **B17 馆内动态 feed** / **B18 收藏·分享** / **B19 自定义分类** / **B20 onboarding wizard** | 【官网/视频】首页动态、收藏分享、自定义分类 | S–M |
| **B8 reading stats / B9 recommendations / B12 audit log / B7 fines** | engagement/governance extras | S–M |
| **B1 Chinese ISBN provider** / **B22 photo→AI vision** | CN metadata coverage (keep for when CN books are added) | S / M |

### Explicitly NOT scheduled (番薯 official left blank — don't treat as fact)
Bottom-tab names/order, back-arrow presence, book-detail cover layout, admin dashboard cards,
color theme (we use **SAP Fiori**), any "+" FAB. We design these ourselves.

### Deferred — Phase 2 (WeChat / China), per ADR 0001/0002
WeChat OAuth, `wx.scanCode`, ICP filing + Tencent/CloudBase migration (also the only real fix
for China latency — see above), Mini Program front end. Gated on the hosting decision.

> **Immediate recommendation:** next PR train = **B3 (multiple copies) → B6 (shelf location)**,
> the data-model foundation under 番薯's detail/reservation/catalog screens. Then P1 (holds +
> 借书码). Build TDD: schema+service unit tests → component → E2E.


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


---

## 番薯借阅 — product teardown + UI / IA reference (user-provided)

> Source: user-provided analysis (2026-10-17), reverse-engineered from the official site,
> early-version screenshots, and an admin-demo video. 番薯借阅 has **no standalone app**: the
> product is four layers — **Reader Mini Program + Admin Mini Program + web backend (auxiliary) +
> Official-Account / WeCom entry points**. Button copy / tab order / redesigns vary across minor
> versions; treat IA as directional, not pixel-exact.

### Positioning — "four layers of subtraction"
Not "a complete library system" but compressing the heaviest library tasks (cataloging, search,
borrow/return, reminders, membership) into **phone + WeChat**:
1. **Setup subtraction** — no hardware/deploy; scan to catalog → individuals/small orgs can open a library.
2. **Operation subtraction** — borrow/return via a WeChat scan, no counter/PC backend.
3. **Memory subtraction** — overdue/arrival reminders + records live in the system, not people's heads.
4. **Operations subtraction** — reviews/favorites/share/hot-book rankings give the library its own content flow.
Hard constraints: 免安装 (scan to use, no App), 免硬件 (one phone), 扫码录书 (own 20M+ ISBN DB),
双端 (reader + admin Mini Programs; web is auxiliary), 可嵌入 (Official Account menu / WeCom), 私有化部署.

### Reader Mini Program — information architecture
Standard Mini Program shell: top = library name + search; middle = content flow; bottom tab bar.
- **Home**: library name + join status (joined / pending); search by title/author/ISBN; blocks for
  新书上线 / 热门借阅, 书单推荐, 馆内动态 (who borrowed what, new arrivals, review stream). Bottom tab
  ≈ 首页 / 书库(分类) / 动态 / 我的.
- **Book detail**: cover, title, author, publisher; 馆藏数 / 可借数 / 在借状态; **shelf location (e.g. A01)**;
  action buttons 借阅 / 预约 / 收藏 / 分享; **review area** (reviews, like, reply); if fully borrowed →
  "已借完" + **到馆通知 toggle**.
- **"我的" (personal center)** — list style: 我想读 · 已借阅 · 已归还 · 已预约(带"距释放还有 X 天") ·
  **生成借书码** (show to admin for offline self-borrow) · 书评 · 收藏 · 消息提醒 (overdue/arrival/join-review).
- **Borrow/return interactions** — two modes: **scan self-service** (reader scans book code → "确认借阅" →
  done); **order / proxy** (reader taps 借阅 → order → admin confirms → pickup/mail). Return: reader side
  shows a "待还清单"; the actual 还书 is usually an admin scan.

### Admin Mini Program — page tree (tool-backend feel, not a content flow)
- **Library settings**: name, type (职工书屋/绘本馆/社区书馆…), join verification (public apply / password /
  review), borrow rules (册数/天数/续借), member levels & permissions.
- **Catalog mgmt (scan-to-catalog)**: core page = a **scan box + a queue of book cards**; scan ISBN →
  auto title/author/cover → pick category/shelf → "已扫 N 本 / 结束录书" → into 藏书 list (filter by
  category/shelf), single-item edit/move-shelf; **batch ops weak** (acknowledged pain).
- **Member mgmt**: member list (avatar, nickname, borrow count); **邀请新成员** (generate join code);
  card-application review; member detail (their loans, validity, permissions); assign **admin sub-accounts**.
- **Borrow/return (admin proxy)**: path = member list → pick person → "TA的借阅" → 还书 (tap) / 借书
  (scan book code → check → confirm). I.e. **"find the person first, then scan the book."**
- **Data / operations**: borrow-record list, overdue list + **一键催还**, hot-book / borrow rankings,
  荐购 list, pending orders (order mode).

### Web backend (PC) — auxiliary only
Left-menu + table pages (藏书表 / 借阅记录表 / 会员表); bulk view, export, member/rule settings,
operational stats. Daily borrow/return is **not** done here.

### Official Account / WeCom — entry points, not a separate UI
Official Account menu → reader Mini Program; WeCom workbench → admin; join-code images + borrow/return
reminders delivered as **WeChat service notifications** (tap → deep-link into the Mini Program page).

### Reader vs Admin at a glance
| Dimension | Reader | Admin |
|---|---|---|
| Feel | reading-community, book-list flow | tool-backend, list + scan |
| First screen | find books, status, reserve | #books, #members, to-dos |
| Core action | search / borrow-code / renew | scan-catalog / proxy borrow-return / review |
| High-freq pages | book detail, my loans | catalog, members, borrow records |
| Web dependence | ~none | export only |

### Known shortcomings (from user feedback)
- **Batch ops weak** (scan one-by-one; moving hundreds across shelves / re-categorizing is painful) → **B21**.
- **Reminders not "default-on"** (overdue reminder must be set manually, doesn't persist next time) → informs R3/B16 defaults.
- **Pricing unfriendly to large personal collections** (per-user pricing) — not applicable to our model.
- Early version was over-loaded / tightly coupled (team acknowledged in a 1.0 rebuild note).

### Implications for OpenBookCorner's two-view design (what we're building)
Our **Reader view / Admin view** split (admins can switch; super-admin adds a System view) maps directly
onto 番薔's reader/admin Mini Program separation. Alignment notes & gaps:
- **Reader view** should trend toward the "reading-community flow": our catalog + My Books exist (✅);
  gaps vs 番薯 reader IA → **到馆通知 toggle** on a borrowed book (B13/R6), **预约/收藏/分享** actions on
  detail (B13/B18), **书评** on detail (R6), **借书码 / scan self-borrow** (B2), **我想读 / 历史 / 预约** lists in
  My Books (B15), a **馆内动态** feed (B17).
- **Admin view** should trend toward the "tool backend": we have Add Book (scan), Overdue (+contact),
  Settings, Feedback (✅); gaps → **scan-queue cataloging UX** ("已扫 N 本") + **batch move-shelf** (B21),
  **member management + invite code + join review + sub-admins** (R4/B11), **admin-proxy borrow/return**
  ("find person → scan book") (B14), **一键催还** on the overdue list (B16), **rankings / 荐购 / orders**
  (B10/R6/B14).
- **System view (super-admin)** — our cross-tenant tenant management; no direct 番薯 analog (番薯 is per-library),
  closest to their SaaS console. Keep distinct from library-admin.
- **Shelf location** (A01-style) recurs in both reader detail and admin cataloging → **B6** gains priority
  as it threads through several screens.


---

## 番薯借阅 — UI spec with source tiers (user-provided, 2026-10-17)

> **Confidence tiers** — do not treat lower tiers as requirements:
> - **【官网确认 / Official】** stated on the official/case site.
> - **【截图·视频可见 / Observed】** visible in early real screenshots or demo videos.
> - **【惯例推断 / Inferred】** standard Mini Program structure; **NOT fact** — do not write into specs.
> No public pixel-level design exists; descriptions stop at "region + position + copy". Two Mini
> Programs (reader + admin), NOT one app with tabs; web backend is auxiliary; phone-driven.

### Reader app
- **Home** — 【Official】 search by 书名/作者/ISBN; 馆内动态 as a feed (new books, reviews, 荐购, arrivals).
  【Inferred】 top = library name; search bar on top; bottom tab bar (names unknown — do not hardcode).
- **Book detail** — 【Official】 details, borrow status, **索书位置 (shelf location)**; "已借完" when out;
  actions 预约 / 到馆通知 / 续借 / 书评 / 收藏 / 分享. 【Observed】 shows title, author, publisher,
  **可借数量**, **书架位置 (e.g. A01)**.
- **"我" → 已预约图书** — 【Observed, most reliable screen】 cards: 书名, 作者, 预约时间, **距释放还有 X 天**,
  书架位置; a wide **「生成借书码」** button at the bottom; 「取消预约」 entry. Flow 【Official】:
  take the book off the shelf → 我 → 已预约图书 → select (default all) → 生成借书码 → admin scans.
- **My loans / history** — 【Official】 在借 / 预约 / 历史 as lists; 续借 button on active loans.
- **Borrow happens via two paths** (NOT "tap Borrow on detail → instantly borrowed"):
  A) 【Observed】 预约 → 生成借书码 → admin scans; B) 【Official】 现场扫码自助借还.

### Admin app
- **Switcher** — 【Observed】 switch library inside the Mini Program; admin vs user are separate; top shows current library name.
- **Scan-to-catalog (core)** — 【Observed】 「扫码入书」 → camera → on scan: 「选择分类」, running count
  ("扫码:(N)"), 「录入」 / 「结束录书」; stays in camera for continuous entry; returns to 藏书 list (count +1).
  Picture-book libraries print spine labels/codes per book.
- **Catalog list** — 【Observed】 total count; grouped by shelf ("书架2"); title + copy info per book.
  【Official】 edit book info on mobile.
- **Members** — 【Observed】 member count, 「邀请新成员」, member list (avatar/nickname) → 「TA的借阅」;
  开通权限 / 分配管理员.
- **Borrow/return** — 【Observed】 NOT a standalone page: member list → person → 「TA的借阅」 → 「还书」
  (inline) / borrow-for-them → scan → confirm. 【Official】 admin proxy borrow/return, 线上寄送, 线下扫码.
- **Stats** — 【Official】 borrow data, hot books, overdue. (chart style not published — don't hardcode.)

### Must NOT write as fact (official left blank)
Bottom-tab names/order; back-arrow presence; cover layout (left-img vs stacked); admin dashboard cards;
color theme (white is a guess); any "+" FAB (that was fabricated, not 番薯); the PC backend's look.

### Fidelity guidance for our PWA
- **Must align (evidence-backed):** reader borrow goes via **预约 → 生成借书码** or **扫码自助** (two paths);
  reservation cards show **距释放还有 X 天 + 书架位**; admin cataloging = camera + 选分类 + 结束录书;
  **还书 lives inside member detail**, not a standalone page; members have **邀请新成员**.
- **Free to design:** overall palette (we use SAP Fiori), tab copy, home feed layout, book-detail layout,
  admin dashboard.
- **Don't copy wrong:** not "reader taps Borrow → instantly borrowed" as the only model; not an app
  (it's two Mini Programs); not PC-backend-driven (phone-driven).

### Extracted must-align requirements → backlog mapping
These evidence-backed behaviors become concrete items (feed into existing B#/R# where they fit):
| Must-align behavior | Backlog item | Notes |
|---|---|---|
| **Reserve/hold** + "距释放还有 X 天" + arrival notify | **B13** (reservations/holds) | reservation card must show days-until-release + shelf loc |
| **生成借书码 (borrow code)** reader self-borrow path | **B2** (scan-to-borrow) extend → add a reader **borrow-code** sub-flow (reader shows code, admin scans) |
| **扫码自助借还** second path | **B2** | already planned |
| **Shelf location (A01)** on detail + reservation + catalog grouping | **B6** (shelf location) | threads through reader detail, holds, admin catalog grouping |
| **Scan-to-catalog UX**: camera + 选分类 + running count + 结束录书 (continuous) | **B21**/new **catalog scan-queue UX** | our Add Book is one-at-a-time; add a continuous scan queue |
| **Catalog grouped by shelf** | **B6** |
| **Admin proxy borrow/return inside member detail** ("find person → scan book") | **B14** (order/proxy modes) | 还书 is inline in member detail, not a page |
| **Member management**: list, **邀请新成员** (invite code), 开通权限, 分配管理员 | **R4 + B11** | invite-code join flow |
| **续借 (renew)** on active loans | **B4** | `allowExtensions` already in settings |
| **Library-defined categories** (选分类 at catalog time) | **B19** |

> These refine (not replace) the existing P0–P3 roadmap. Suggested near-term, evidence-backed slice:
> **B3 (multiple copies)** → **B6 (shelf location)** → **B13 (holds + 借书码 + 距释放 X 天)** → **B2 (scan-to-borrow + borrow-code)**,
> since copies+shelf-location underpin the reservation and catalog screens that 番薯's real UI centers on.
