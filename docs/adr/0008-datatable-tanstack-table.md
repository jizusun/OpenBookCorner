# ADR 0008: Upgrade the admin DataTable to TanStack Table (full shadcn-admin behavior set)

## Status

Accepted — implements the "data-table behaviors" ask, aligning our admin list
tables with the shadcn-admin (satnaing) data-table feature set.

## Context

Our admin list pages (Users, Books, Tenants, Audit) all render through a single
hand-written `DataTable` (`apps/app/components/ui/DataTable.tsx`) that owns the
container, header, row styling, loading and empty states. It takes
`Column<T> { header, cell, muted?, srHeader? }` and `rows/loading/columns/…`.

It is intentionally quiet and consistent, but it has **no interaction**: no
column sorting, no in-table search, no multi-select faceted filters, no column
show/hide, no pagination (pages did their own server-side `Pager`), no row
selection or bulk actions. The user asked to match the behaviors of the
shadcn-admin tables, whose data-table (adapted from the shadcn "tasks" example)
provides: column-header sorting, a toolbar (search + faceted filters + reset),
view-options (column visibility), pagination (page size + page nav), row
selection, and bulk actions.

## Decision

Rebuild `DataTable` on **`@tanstack/react-table` v8** (headless: it owns the
sorting/filtering/visibility/pagination/selection **state models**; we keep our
own quiet `<table>` markup and shadcn primitives for rendering). Pinned
dependency `@tanstack/react-table@8.21.3`. Added shadcn primitives used by the
toolbar/filters: `table`, `checkbox`, `select`, `popover`, `command` (+ `dialog`
pulled by `command`), matching the existing primitive style (`radix-ui` meta
package + `cn`), consistent with ADR 0007's primitives.

**Backward compatible.** The existing `Column<T>`/`DataTableProps` shape keeps
working unchanged, so a page that passes only `columns/rows/...` renders exactly
as before. New behavior is **opt-in** per column / per table:

- `Column.id?`, `Column.sortable?`, `Column.sortValue?(row)` — enable client
  sorting on that column (header toggles none→asc→desc, shows an arrow +
  `aria-sort`). Pure columns (e.g. Actions) stay non-sortable.
- `Column.filterId?` + `DataTableProps.toolbar.faceted[]` — multi-select faceted
  filters (with option counts), like shadcn-admin's `data-table-faceted-filter`.
- `DataTableProps.toolbar.search` — in-table keyword search across chosen fields.
- `DataTableProps.enableColumnVisibility` — a "View" dropdown to show/hide
  columns (`data-table-view-options`).
- `DataTableProps.enablePagination` + `pageSize` — client pagination with a page
  size select + prev/next + "page x of y" (`data-table-pagination`).
- `DataTableProps.enableRowSelection` + `bulkActions` — a checkbox column, a
  "N selected" bar, and a bulk-action slot (`data-table-bulk-actions`).
- A **Reset** control clears all filters/search when any is active.

**Client-side first.** shadcn-admin paginates/filters client-side (load all,
the table slices). Our Users/Books/Audit pages were server-paginated. For parity
and to get the full interaction, those pages now fetch the full (currently
small) dataset and let the table do pagination/sort/filter in the browser.
`DataTable` reserves `manualPagination`/`manualSorting` escape hatches so a page
can switch back to server mode when a dataset grows large — tracked in
`docs/TODO.md`.

**Pure, testable core.** Sorting/filtering/faceting/page-slicing are extracted
to pure functions in `apps/app/components/ui/data-table-model.ts` so the bulk of
the behavior is covered by fast unit tests (testing-pyramid: unit ≫ component ≫
E2E), with react-table wiring verified at the component layer and one real
sort+search flow at E2E.

## Consequences

- All four admin tables gain sorting, in-table search, faceted filters, column
  visibility, client pagination, and row selection with no change to their quiet
  look. One real bulk action is wired as a reference; the rest are TODO.
- One new runtime dep (`@tanstack/react-table`) + 5 shadcn primitives. No
  zustand (table state is component-local via react-table hooks).
- Server pagination is temporarily traded for client pagination on a few pages;
  acceptable at current data sizes, with a documented path back to server mode.
- The pure model + opt-in props keep the change low-risk and incremental; pages
  not opting in are byte-for-byte unchanged in behavior.

## References

- shadcn-admin data-table components (satnaing/shadcn-admin `src/features/tasks/components`).
- Supersedes nothing; complements ADR 0007 (sidebar shell) on the shadcn-admin alignment track.
