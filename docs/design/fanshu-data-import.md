# Design — Import 番薯借阅 export (full data migration) + admin Import UI

Status: Proposed · Scope: data migration + schema extensions + admin import feature
Source file (archived in R2): `openbookcorner-covers/imports/fanshu/librarydata_5c3b3346.xls`
(etag `b8c65b2844531018fb32c0c391bca10e`, 932 KB, 6 sheets)

## Goal

Keep **all** data from the 番薯借阅 export and import it into OpenBookCorner.
Where our current model can't hold a field, **extend the model** rather than drop
data. Deliver in two stages the user asked for:

1. **Manual migration first** — a repeatable script that maps the Excel → our
   schema, so we can validate the mapping against real data before touching the UI.
2. **Admin Import UI** — an admin uploads the `.xls`, sees a parsed preview/list,
   clicks **Import**, and the data lands in their library (tenant-scoped).

## The export (verified from the real file)

| Sheet | Rows | Meaning | Maps to |
|---|---|---|---|
| 书籍清单 | 634 | Book catalog (one row per copy; 47 ISBNs appear 2×) | `books` (+ new fields) |
| 存量明细 | 572 | Stock per unique ISBN: 书籍总量/在架数量/已借出数量 | `books.quantity`/`availableCount` |
| 成员清单 | 181 | Members (1 馆长, 9 管理员, 171 普通成员) | `user` (+ new `members` profile) |
| 借阅清单 | 724 | Loans (703 已归还, 21 借阅中) | `borrowTransactions` |
| 评论清单 | 15 | Reviews | NEW `reviews` table |
| 荐购清单 | 17 | Purchase requests (荐购) | NEW `purchase_requests` table |

Verified consistency: 存量明细 sums = 634 total / 613 available / 21 out, and
exactly **21 loans are 借阅中** — so stock = total − active loans. 100% of loans'
`成员名称` match a member `姓名`; all books have an ISBN. These let us join
loans→members (by name) and loans→books (by ISBN) reliably.

## Hard problems (surfaced from the data)

1. **Members have NO email (0/181), only names + phones (131/181).** Our auth
   (Better Auth) keys identity on **email**. 34 rows have a blank name and 6 are
   "微信用户"; two names are duplicated. → We cannot create real login accounts
   from this. **Decision: import members as library *profiles/records*, not auth
   users.** They become borrowable identities with name/phone/会员号, and can be
   *linked to* / claimed by a real Better Auth account later (by email invite).
   This needs a new `members` concept distinct from `user`.
2. **番薯 "one row per copy" vs our "one book + quantity".** 47 ISBNs repeat.
   Use 存量明细 (authoritative per-ISBN totals) for `quantity`/`availableCount`;
   deduplicate 书籍清单 by ISBN. Keep 馆内编码 (per-copy code) — see schema.
3. **Loans reference members, not users.** Since members aren't `user` rows, the
   `borrowTransactions.userId → user.id` FK won't fit. → loans must reference a
   `members.id` (new), not `user.id`. This is a model change.
4. **Dates/か timezones**: 番薯 uses `YYYY-MM-DD[ HH:mm:ss]` strings and (in
   reviews) Excel serial numbers (e.g. `45609.63`). Normalize both to ISO.
5. **Role mapping**: 馆长→(library_admin, is the owner), 管理员→library_admin,
   普通成员→library_reader. (super_admin is NOT granted via import.)

## Proposed schema extensions (`db/schema/domain.ts`)

Rather than overload `user`, introduce a tenant-scoped **`members`** table (the
番薯 member record), and point loans at it. Keep `user` for people who actually
log in; a member MAY link to a user.

```ts
// NEW: library member record (borrowable identity; not necessarily a login).
export const members = sqliteTable('members', {
  id: text('id').primaryKey(),
  libraryId: text('library_id').notNull().references(() => libraries.id),
  name: text('name').notNull(),
  role: text('role', { enum: ['library_admin','library_reader'] }).notNull().default('library_reader'),
  phone: text('phone'),
  email: text('email'),               // usually empty from 番薯
  memberNo: text('member_no'),         // 会员号
  employeeNo: text('employee_no'),     // 工号
  studentNo: text('student_no'),       // 学号
  className: text('class_name'),       // 班级
  department: text('department'),      // 部门
  note: text('note'),                  // 备注1/备注2 merged
  joinedAt: text('joined_at'),         // 入馆日期
  // optional link to a real auth user who claimed this member
  userId: text('user_id').references(() => user.id),
  source: text('source'),              // 'fanshu-import' for provenance
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
})

// books: add the 番薯 fields we currently drop
//   + copyCode (馆内编码), category (所属分类), shelfLocation (所属书架 — also B6!),
//   + translator (译者), series (系列), pageCount (页数), price (价格), priceUnit,
//   + cnLibraryClass (中图法分类号), enteredAt (录入时间)
// (add as nullable columns; keep existing columns intact)

// borrowTransactions: change userId → memberId (reference members.id). Keep a
// nullable userId too if a loan was by a real user. Add 'status' derived from
// 借阅状态 + the 馆内编码/copy identity if needed.

// NEW: reviews (评论清单)
export const reviews = sqliteTable('reviews', {
  id: text('id').primaryKey(),
  libraryId: text('library_id').notNull().references(() => libraries.id),
  isbn: text('isbn'),
  bookTitle: text('book_title'),
  memberName: text('member_name'),     // 用户馆内名称
  nickname: text('nickname'),           // 用户昵称 (e.g. 微信用户)
  body: text('body').notNull(),
  createdAt: text('created_at'),
})

// NEW: purchase_requests (荐购清单)
export const purchaseRequests = sqliteTable('purchase_requests', {
  id: text('id').primaryKey(),
  libraryId: text('library_id').notNull().references(() => libraries.id),
  isbn: text('isbn'),
  title: text('title').notNull(),
  author: text('author'),
  publisher: text('publisher'),
  requesterCount: integer('requester_count').default(1), // 荐购人数
  requesters: text('requesters'),                         // 荐购人
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
})
```

> `shelfLocation` (所属书架) doubles as the P0 **B6 shelf-location** field — this
> import gives us real data for it, so B6 and this import should be coordinated.

### FK change impact (loans → members)

Changing `borrowTransactions.userId` to reference `members` is the biggest ripple.
Options:
- **(A)** add `memberId` (nullable, → members) alongside the existing `userId`
  (nullable, → user). Imported loans set `memberId`; app-created loans set
  `userId`. Services/queries updated to handle both. *Lower blast radius, migratable.*
- **(B)** make everyone a `member` (even login users get a member row) and loans
  always point at `members`. *Cleaner long-term, bigger refactor.*
Recommend **(A)** now; consider (B) later. This is a decision to confirm.

## Migration script (stage 1 — manual, repeatable)

`db/scripts/import-fanshu.ts` (run with Bun), driven by SheetJS:

1. Parse the 6 sheets.
2. Build **books**: dedupe 书籍清单 by ISBN; set quantity/availableCount from
   存量明细 (fallback: count of rows per ISBN for qty, qty−activeLoans for avail).
   Map the extra columns.
3. Build **members** from 成员清单 (skip/flag blank-name + 微信用户 rows; map roles).
4. Build **loans** from 借阅清单: resolve member by 成员名称, book by ISBN;
   borrowedAt=借书日期, dueDate=应还日期, returnedAt=还书日期 (null if 借阅中).
5. Build **reviews** + **purchase_requests** verbatim.
6. Output: either (a) a set of `INSERT` SQL for `wrangler d1 execute`, or (b)
   call our services directly against a target D1. Produce a **dry-run report**
   first: counts, unmatched loans, skipped members, duplicate ISBNs, date-parse
   failures — so we validate before writing.

Idempotency: upsert books by (libraryId, isbn); members by (libraryId, 会员号 or
name+phone); loans by a natural key (member+isbn+borrowedAt). `source='fanshu-import'`
tags everything so a bad import can be rolled back by source.

## Admin Import UI (stage 2)

- New admin route `/_app/admin/import` (adminProcedure-gated).
- Upload `.xls/.xlsx` → client parses with SheetJS (lazy-loaded) OR uploads bytes
  to a `library.importPreview` procedure that returns a **preview**: detected
  sheets, row counts, and a sample + validation warnings (unmatched rows, etc.).
- Admin reviews the preview list, then clicks **Import** → `library.importCommit`
  runs the mapping tenant-scoped into `ctx.libraryId`, in batches, idempotently.
- Show a result summary (created/updated/skipped per entity) + downloadable error
  report. Store the raw upload to R2 (`imports/<libraryId>/<ts>.xls`) for audit.
- Guard: large files → batch D1 writes (D1 has per-query limits); run in chunks.

## Testing (TDD)

- **Unit** (`import-fanshu.test.ts`): feed a tiny fixture workbook (built in-test
  with SheetJS) covering: multi-copy ISBN, 借阅中 vs 已归还, blank-name member,
  Excel-serial date, role mapping. Assert the produced books/members/loans/reviews.
- **Service**: importCommit is idempotent (run twice → no dupes); tenant-scoped.
- **Component**: import route renders preview + disables Import on validation errors.
- **E2E**: upload a fixture `.xls` as admin → preview → import → see books in catalog.

## Phasing

1. **Schema extensions** (members, books columns, reviews, purchase_requests,
   loans memberId) + migration. 
2. **Manual import script** + dry-run report; validate against the real file.
3. **Import tRPC** (preview + commit) tenant-scoped + R2 archival.
4. **Admin Import UI** + tests.

## Open questions (need your call)

1. **Members-as-profiles vs forcing emails.** I recommend the new `members` table
   (members aren't login users; 0 emails in the data). Confirm — this is the
   central modeling decision.
2. **Loans FK**: option (A) add `memberId` alongside `userId` (recommended) vs
   (B) unify everyone as members. 
3. **Which library (tenant)** do we import into — a fresh one for this org, or an
   existing demo? (Import is tenant-scoped; I'd create a dedicated library.)
4. **Blank-name / 微信用户 members (40 rows)** — import as "Unknown #n" so their
   loans/reviews are preserved, or skip? (I lean import-with-placeholder to keep
   loan history complete.)
5. **Prices/价格 + 价格单位** — keep on books (we have mixed USD/CNY) — yes?
```
