# OpenBookCorner — Feature Inventory

Structured catalogue of every implemented feature. Update this file whenever
a feature ships. Features are grouped by role / surface, then by functional
area. Status symbols: ✅ shipped · ⚠️ partial (noted) · 🔜 planned (in TODO).

Last updated: 2026-10-22

---

## 1. Authentication & Accounts

| Feature | Detail | Status |
|---|---|---|
| Self-registration | `/signup` — email + password + confirm. shadcn-admin form (react-hook-form + zod, PasswordInput with Eye/EyeOff toggle, Loader2 icon) | ✅ |
| Sign in | `/login` — react-hook-form + zod, PasswordInput, Loader2+LogIn icon, "Don't have an account?" cross-link. Bitwarden/1Password autofill: `name`, `autocomplete=username/current-password`, `method=post` | ✅ |
| Sign out | User menu → Sign out. Posts `{}` to Better Auth `/sign-out` so session is actually invalidated (fixes empty-body 400 bug) | ✅ |
| Tenant-branded login | `/t/<slug>/login` or `/t/<libraryId>/login` — shows library logo/name/welcome message. Stable ID-based URL never breaks on slug rename; slug stays as a readable alias (`getByIdOrSlug`) | ✅ |
| Password show/hide | `PasswordInput` component with Eye/EyeOff toggle on all password fields | ✅ |
| Profile page | `/profile` — display name edit (Better Auth `updateUser`), avatar, email, role badge. Saves → refetches identity + `router.invalidate()` so sidebar/header update immediately | ✅ |
| Initials avatar | `UserAvatar` — deterministic colour per name (stable hash → 7-colour palette), initials (up to 2 letters), three sizes | ✅ |
| Post-signup empty state | `/welcome` — new user with no active library sees "Create a library" or "Discover libraries" cards | ✅ |

---

## 2. Multi-Library Membership (ADR 0009)

| Feature | Detail | Status |
|---|---|---|
| Multi-library membership | A user can belong to multiple libraries simultaneously. Memberships stored in `membership` table (userId × libraryId × role × status). Role is per-library (admin in one, reader in another) | ✅ |
| Create library | Any signed-in user can create a library and becomes its `library_admin` (membership row created, `active_library_id` set) | ✅ |
| Library switcher | Top-left sidebar dropdown lists all the user's active libraries with role badge (Admin/Reader). Switching persists `active_library_id` server-side and reloads the app | ✅ |
| Role badge in header | Top bar shows `[Library Name] · Admin/Reader` badge (desktop) so the user always knows their current permission level | ✅ |
| Tenant isolation | `tenant` middleware resolves role from the active membership, not from `user.role`. `super_admin` bypasses (platform scope). Transition fallback for legacy single-library users | ✅ |
| Discover public libraries | `/discover` — lists public libraries the user doesn't already belong to. Each card has "Request to join" | ✅ |
| Request to join | Users submit a join request (button or invite link). Requests are pending until an admin approves or rejects | ✅ |
| Admin approval queue | `/admin/join-requests` — pending requests with Approve / Reject buttons. Approving creates an active membership | ✅ |
| Custom join forms | Per-library join form fields (key, label, type, required, verifyEmail). Presets from 番薯 member schema: 工号/部门/学号/班级/公司邮箱/手机号/会员号/房号/地址. Admin manages in Settings | ✅ |
| Company-email verification gate | Join form field with `verifyEmail=true` prevents submit until the email is confirmed. UI shows note; full OTP email send in Phase 2 | ⚠️ |
| Invite links | `/admin/invites` — create token-only invite links (`/join/<token>`). Options: auto-join (skip approval) or requires-approval, max uses, expiry days, role. Admin can revoke | ✅ |
| Invite link landing | `/join/<token>` — public page shows library name and join / submit-request button. Prompts unauthenticated users to sign in first | ✅ |
| Stable invite URLs | Invite links use a random token only (no slug or library ID) — immutable, never breaks on slug rename, unguessable | ✅ |
| Membership lifecycle | `active / suspended / removed` states. Suspended/removed users cannot access the library | ✅ |

---

## 3. Reader Surface

| Feature | Detail | Status |
|---|---|---|
| Book catalog | `/books` — searchable, filterable list with cover images, availability badges. Book detail page | ✅ |
| Borrow & return | One-click borrow from catalog or scan page. Return from My Books | ✅ |
| My Books | `/my-books` — active loans with due dates, overdue highlight, return button | ✅ |
| Scan to borrow | `/scan` — type or scan an ISBN to borrow in one step (camera API, Phase 2: WeChat wx.scanCode) | ✅ |
| Overdue indicator | Overdue loans shown in red in My Books | ✅ |
| Discover libraries | `/discover` — find public libraries and request to join | ✅ |
| Reader nav groups | Sidebar: My Books / Scan / Catalog / Discover | ✅ |

---

## 4. Library Admin Surface

### 4.1 Catalog

| Feature | Detail | Status |
|---|---|---|
| Book list | Sortable/searchable/filterable admin books table. Client-side DataTable (sort by title/author/etc., search, column visibility, pagination) | ✅ |
| Add book | ISBN lookup → auto-fill from Open Library / Google Books. Manual entry fallback | ✅ |
| Edit book | Edit title, author, ISBN, copies, cover | ✅ |
| Multiple copies | `quantity` + `availableCount` fields; borrowing decrements, returning increments | ✅ |
| Cover images | Uploaded to Cloudflare R2, served via `/covers/:key` | ✅ |

### 4.2 Readers (Members)

| Feature | Detail | Status |
|---|---|---|
| Members list | Sortable/searchable/faceted DataTable. Member detail page with loan history | ✅ |
| Add reader | Create a reader account directly from the admin UI (`AddUserDialog`) | ✅ |
| Enable login | Provision a login account for an existing roster entry (`enable-login` flow, ADR 0006) | ✅ |
| Impersonate reader | Sign in as a reader to reproduce issues. Persistent banner, time-boxed session, one-click exit, full audit trail. Super admin only; readers only (admins cannot be impersonated) | ✅ |

### 4.3 Circulation

| Feature | Detail | Status |
|---|---|---|
| Overdue list | `/admin/overdue` — all overdue loans in the library | ✅ |
| Activity log | `/admin/activity` — recent changes in this library (via audit log filtered by libraryId) | ✅ |

### 4.4 Members & Access

| Feature | Detail | Status |
|---|---|---|
| Join requests | Approve / reject incoming requests | ✅ |
| Invite links | Create, list, revoke invite links (auto-join or approval-required) | ✅ |
| Join form builder | Add/remove custom fields for join requests. Presets for 工号/部门/学号/班级/邮箱 etc. | ✅ |

### 4.5 Feedback & Communication

| Feature | Detail | Status |
|---|---|---|
| Feedback inbox | `/admin/feedback` — reader-submitted feedback (feature requests, book suggestions, bugs) | ✅ |
| Feedback button | Floating bottom-right button visible to all authenticated users | ✅ |
| Email sending | Needed for join-form email verification, overdue reminders, welcome emails | 🔜 Phase 2 (recommend Resend) |

### 4.6 Import

| Feature | Detail | Status |
|---|---|---|
| 番薯 import | Upload a 番薯 (Fanshu) `.xls` export → preview counts → import books / members / loans / reviews / purchase requests in one step | ✅ |
| Import history | Lists previous import runs with status and counts | ✅ |

### 4.7 Settings

| Feature | Detail | Status |
|---|---|---|
| Library settings | Name, borrowing period, max books per reader, allow extensions | ✅ |
| Join form settings | Manage per-library join form fields (in the Settings page) | ✅ |

### 4.8 Nav & UI

| Feature | Detail | Status |
|---|---|---|
| Grouped sidebar nav | 3 labelled groups: Library (Catalog/Readers/Overdue) · Members (Join requests/Invites) · More (Feedback/Activity/Settings/Import) | ✅ |
| Reader preview | Library admin can preview the catalog as a reader sees it (toggle in top bar) | ✅ |

---

## 5. Super Admin Surface

| Feature | Detail | Status |
|---|---|---|
| Overview dashboard | Stat cards (tenant/user/book counts), each drills down to its list. Recent system activity | ✅ |
| Tenants list | Sortable/searchable/faceted (by Status) DataTable. Create, edit, (de)activate, delete | ✅ |
| Tenant detail | Members list, users list, Add admin button, edit branding (slug, logo, brand colour, welcome message), delete with confirmation | ✅ |
| Stable login link | Tenant admin page copies `/t/<libraryId>/login` — permanent link; slug is a readable alias that also resolves | ✅ |
| Users list | All login accounts across tenants. Sortable/searchable, Role faceted filter | ✅ |
| Cross-tenant books | All books across all tenants | ✅ |
| Audit log | Append-only system-wide audit log. Filter by tenant + action. Paginated | ✅ |
| System settings | `/admin/system` — system-level configuration | ✅ |
| Impersonation | Sign in as any reader, time-boxed, audited (ADR 0004). Impersonation banner with Back button | ✅ |
| System nav | Single "System" group: Overview / Tenants / Users / Books / Audit log / System settings | ✅ |

---

## 6. Shell & Navigation

| Feature | Detail | Status |
|---|---|---|
| Sidebar shell | shadcn-admin-style left sidebar (ADR 0007): brand header, grouped nav, collapsible icon rail on desktop, mobile overlay drawer | ✅ |
| Mobile drawer | Drawer closes automatically after navigating (pathname-change effect) | ✅ |
| Library switcher | Top-left dropdown: all user's libraries with role badges. Switch persists server-side | ✅ |
| Role/library indicator | Top bar badge shows current library name + Admin/Reader role | ✅ |
| Top-right account menu | Avatar button → Profile / Install app / Sign out (`UserMenu`) | ✅ |
| Language toggle | EN / 简体中文 switch. Persists in localStorage. All UI strings translated | ✅ |
| Dark mode | Light/dark theme toggle (ThemeToggle) | ✅ |
| PWA / installable | Web App Manifest, install prompt (top-right menu when available) | ✅ |

---

## 7. DataTable (ADR 0008)

All admin list pages use the shared `DataTable` on `@tanstack/react-table`.

| Feature | Detail | Status |
|---|---|---|
| Column sorting | Click header to cycle none→asc→desc. `aria-sort` on `<th>` | ✅ |
| Toolbar search | Keyword filter across specified columns | ✅ |
| Faceted filters | Multi-select with option counts (e.g. Role, Status) | ✅ |
| Column visibility | "View" dropdown to show/hide columns | ✅ |
| Client pagination | Page size selector + prev/next + "Page x of y" | ✅ |
| Row selection | Checkbox column + "N selected" bulk-action bar | ✅ |
| Bulk actions | Framework + bar UI shipped; specific actions (batch delete etc.) need batch API endpoints | ⚠️ |
| Reset | Clears all active filters/search | ✅ |

---

## 8. Dialogs & UI Primitives

| Feature | Detail | Status |
|---|---|---|
| shadcn Dialog | `Modal` backed by Radix `Dialog` — structured `DialogHeader`/`DialogTitle`/`DialogDescription`/`DialogFooter` matching shadcn-admin | ✅ |
| Alert Dialog | `ConfirmDialog` backed by Radix `AlertDialog` — semantic destructive confirm | ✅ |
| Password input | `PasswordInput` — show/hide toggle (Eye/EyeOff), matches shadcn-admin exactly | ✅ |
| Form validation | `react-hook-form` + `zod` on login + signup. `FormField`/`FormMessage` inline errors | ✅ |
| Toast notifications | Custom `ToastProvider` (success / error / info). Auto-dismiss | ✅ |
| Empty states | `EmptyState` — icon + title + description for zero-data views | ✅ |
| Skeleton loaders | Page/list/form/detail skeleton variants | ✅ |
| `UserAvatar` | Initials + deterministic colour | ✅ |

---

## 9. Infrastructure & Developer Experience

| Feature | Detail | Status |
|---|---|---|
| Stack | React 19, TanStack Router (file-based) + Query, Hono API, Better Auth, Drizzle ORM, Cloudflare Workers + D1 + R2, Bun monorepo | ✅ |
| Type-safe API | `hc<Api>` typed client; end-to-end inference from route → service → frontend | ✅ |
| Bilingual i18n | `@lingui/react` — EN source + zh-Hans translations. `i18n:extract --clean` CI gate | ✅ |
| Audit log | Append-only `audit_logs` table (ADR 0005). Every privileged action logged server-side | ✅ |
| Multi-tenancy | All queries scoped by `libraryId`. `tenant` middleware derives scope from active membership | ✅ |
| Testing pyramid | Unit (pure models + services) · Integration (Hono test harness) · Component (RTL + jsdom) · E2E (Playwright). 235 unit+int · 146 component · 35 E2E | ✅ |
| CI | GitHub Actions: typecheck · test · build · E2E · CodeQL · Preview deploy | ✅ |
| Preview deploys | Each PR deploys to `https://preview.openbookcorner.jizu.dev` (shared preview Worker, seeded demo users) | ✅ |
| Local HTTPS preview | Tailscale cert + Node TLS proxy. `scripts/preview-refresh.sh` builds + restarts worker + renews cert | ✅ |
| Tenant subdomains | `/t/<slug>/` path-based branding (ADR 0003). Stable ID-based login URL (ADR 0009) | ✅ |
| ADRs | 9 Architecture Decision Records documenting all major choices | ✅ |

---

## 10. Planned / Phase 2

| Feature | Notes |
|---|---|
| Email sending | Join-form email verification OTP, overdue reminders, welcome emails. Recommend **Resend** (free tier 3k/month, Cloudflare Workers SDK) |
| Bulk actions (tables) | Batch delete/activate via batch API endpoints |
| Client pagination >200 rows | Users/Books lists currently cap at 200 (API max). Switch to `manualPagination` when dataset grows |
| WeChat OAuth + `wx.scanCode` | Phase 2 China deployment (ADR 0001) |
| Server-mode DataTable | `manualPagination`/`manualSorting` escape hatches already in DataTable |
| Real bulk action per table | Framework ships; needs batch API endpoints |
| AuditTable DataTable upgrade | Still server-paginated; migrate to DataTable toolbar when server-mode lands |
| Forgot password flow | Not implemented; Better Auth supports it |
| Email verification on sign-up | `requireEmailVerification: false` currently; enable when email sending is ready |
| Command palette (⌘K) | Global search/navigation (shadcn-admin feature, tracked in backlog) |
| Public library discovery (full) | `/discover` is a placeholder; filter/search/pagination when more libraries exist |
