/**
 * Pure data-table behavior model. These functions hold ALL the table logic
 * (sort / search / faceted filter / pagination), independent of React or
 * TanStack Table, so the bulk of the behavior is covered by fast unit tests
 * (testing pyramid: unit ≫ component ≫ E2E). The DataTable component wires
 * TanStack Table for ergonomics, but the semantics are defined and verified
 * here.
 */

export type SortDir = 'none' | 'asc' | 'desc'

/** Header click cycle: none → asc → desc → none. */
export function nextSortDir(cur: SortDir): SortDir {
  return cur === 'none' ? 'asc' : cur === 'asc' ? 'desc' : 'none'
}

export type SortValue<T> = (row: T) => string | number | null | undefined

export interface SortState<T> {
  dir: SortDir
  value: SortValue<T>
}

/**
 * Stable sort. Strings compare by locale (case-insensitive); numbers compare
 * numerically. null/undefined sort last (regardless of direction). dir 'none'
 * returns the input order unchanged.
 */
export function sortRows<T>(rows: T[], state: SortState<T> | null): T[] {
  if (!state || state.dir === 'none') return rows
  const { dir, value } = state
  const factor = dir === 'asc' ? 1 : -1
  // decorate-sort-undecorate keeps it stable across engines
  return rows
    .map((row, i) => ({ row, i }))
    .sort((a, b) => {
      const av = value(a.row)
      const bv = value(b.row)
      const aNil = av === null || av === undefined || av === ''
      const bNil = bv === null || bv === undefined || bv === ''
      if (aNil && bNil) return a.i - b.i
      if (aNil) return 1 // nils always last
      if (bNil) return -1
      let cmp: number
      if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv
      else cmp = String(av).localeCompare(String(bv), undefined, { sensitivity: 'base', numeric: true })
      if (cmp !== 0) return cmp * factor
      return a.i - b.i // stable tie-break by original index
    })
    .map((d) => d.row)
}

/**
 * Keyword filter across the given accessors (OR across fields).
 * Empty/whitespace query returns all rows. Case-insensitive, trims the query.
 */
export function filterRows<T>(rows: T[], query: string, searchKeys: Array<(row: T) => unknown>): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return rows
  return rows.filter((row) =>
    searchKeys.some((k) => {
      const v = k(row)
      return v != null && String(v).toLowerCase().includes(q)
    }),
  )
}

export interface FacetedState<T> {
  /** Accessor that yields the row's value for this facet. */
  value: (row: T) => string
  /** Selected option values; empty = no filtering (show all). */
  selected: string[]
}

/** Apply one or more faceted (multi-select) filters. AND across facets, OR within a facet. */
export function applyFaceted<T>(rows: T[], facets: FacetedState<T>[]): T[] {
  const active = facets.filter((f) => f.selected.length > 0)
  if (active.length === 0) return rows
  return rows.filter((row) => active.every((f) => f.selected.includes(f.value(row))))
}

/** Count rows per facet option (for the little count badges in the filter). */
export function facetCounts<T>(rows: T[], value: (row: T) => string): Map<string, number> {
  const m = new Map<string, number>()
  for (const row of rows) {
    const v = value(row)
    m.set(v, (m.get(v) ?? 0) + 1)
  }
  return m
}

export interface PageState {
  pageIndex: number // 0-based
  pageSize: number
}

/** Slice rows for the current page. */
export function pageRows<T>(rows: T[], { pageIndex, pageSize }: PageState): T[] {
  const start = pageIndex * pageSize
  return rows.slice(start, start + pageSize)
}

/** Total number of pages for a row count (>= 1). */
export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize))
}

/** Clamp a desired page index into range given a (possibly shrunk) row count. */
export function clampPageIndex(pageIndex: number, total: number, pageSize: number): number {
  return Math.min(Math.max(0, pageIndex), pageCount(total, pageSize) - 1)
}
