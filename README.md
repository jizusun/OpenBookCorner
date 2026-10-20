# OpenBookCorner

**Turn your organization's scattered books into a shared, searchable library.**

OpenBookCorner is a multi-tenant library-management Progressive Web App (PWA):
every organization ("library/tenant") gets its own isolated catalog, members,
and borrowing records. It runs on Cloudflare's free tier, so a small library can
operate at essentially no cost.

> This README is for people who want to **use** OpenBookCorner. Developers: see
> [`docs/development.md`](docs/development.md) (architecture + dev workflow) and
> [`docs/deployment.md`](docs/deployment.md) (how to deploy it yourself).

## Who it's for

- **Readers** — find and borrow books, scan to borrow, track what you have out.
- **Library admins** — manage the catalog, members, borrowing and overdues,
  import an existing library, and see your library's activity.
- **Super admins (platform operator)** — manage all tenants, users and books
  across the system, with a full audit log.

## Features

### For readers
- **Browse & search** the catalog (title / author / ISBN).
- **Borrow & return**, with per-library borrowing limits and due dates.
- **Scan to borrow** — type or scan an ISBN to borrow in one step.
- **My Books** — your current loans and due dates.
- **Installable PWA** — add to your phone's home screen; works like an app.
- **Bilingual UI** — English / 简体中文 (switch anytime).

### For library admins
- **Catalog management** — add / edit / remove books, multiple copies per title.
- **Members (readers roster)** — search, view details, track loans & overdues.
- **Add a reader** — create a reader account directly, or **enable login** for an
  existing roster entry (e.g. someone imported from your old system).
- **Overdue tracking** and **reader feedback** inbox.
- **Import an existing library** — one-click import from a 番薯 (Fanshu) export
  (books, members, loans, reviews, purchase requests).
- **Branded tenant login** — your library's name, color and welcome message at
  `/(t)/your-slug/login`.
- **Activity log** — recent changes in your library.
- **Reader preview** — see the catalog as a member does.

### For super admins
- **Overview dashboard** — tenant / user / book counts, each a drill-down to its
  list, plus recent system activity.
- **Tenants** — create, edit, (de)activate, delete libraries; drill into any
  tenant to see its users and add an admin.
- **Users** — every login account across all tenants, searchable.
- **Books** — every book across all tenants, searchable.
- **Audit log** — every change across the whole system, filterable by tenant and
  action, paginated.
- **Impersonation** — sign in as a reader to reproduce an issue, with a
  persistent banner, a time-boxed session, a one-click "Back to my account", and
  a full audit trail. (Readers only; admins can't be impersonated.)

### Built-in safety
- **Complete tenant isolation** — a library can never see another's data.
- **Role-based access** — super admin / library admin / reader.
- **Append-only audit log** of privileged actions (who did what, when).

## Using OpenBookCorner

### Option 1 — Use our hosted instance
The quickest way: use the OpenBookCorner instance we run on Cloudflare — nothing
to install. Ask us (or your organization's admin) for an invite; your library
admin adds you as a reader, or you sign up with your work email and are matched
to your organization by email domain.

### Option 2 — Self-host on your own Cloudflare account
OpenBookCorner is designed to run on Cloudflare's **free tier** (Workers + D1 +
R2), so most small/medium libraries run **$0/month**. You deploy it to your own
Cloudflare account and own all your data. Step-by-step instructions are in
[`docs/deployment.md`](docs/deployment.md).

Roughly:
1. Create a Cloudflare account; create a D1 database and an R2 bucket.
2. Set the app secret and deploy the Worker (one command).
3. Apply database migrations; create your first super admin.
4. Create a library (tenant), add its admin — they take it from there.

## Cost

On Cloudflare's free tier (D1 100k reads/day, Workers 100k req/day, R2 10 GB):
- **Small library (<100 readers):** typically **$0/month**.
- **Larger libraries:** low single/double-digit dollars as you exceed free limits.

## License

MIT — see [LICENSE](LICENSE).
