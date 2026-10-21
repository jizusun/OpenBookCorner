import { describe, it, expect } from 'vitest'
import {
  nextSortDir,
  sortRows,
  filterRows,
  applyFaceted,
  facetCounts,
  pageRows,
  pageCount,
  clampPageIndex,
  type SortState,
} from './data-table-model'

interface Row {
  id: string
  name: string
  n: number
  role: string
  tenant?: string | null
}

const rows: Row[] = [
  { id: '1', name: 'Charlie', n: 3, role: 'reader', tenant: 'Acme' },
  { id: '2', name: 'alice', n: 1, role: 'admin', tenant: null },
  { id: '3', name: 'Bob', n: 2, role: 'reader', tenant: 'Beta' },
]

describe('nextSortDir', () => {
  it('cycles none → asc → desc → none', () => {
    expect(nextSortDir('none')).toBe('asc')
    expect(nextSortDir('asc')).toBe('desc')
    expect(nextSortDir('desc')).toBe('none')
  })
})

describe('sortRows', () => {
  const byName: SortState<Row> = { dir: 'asc', value: (r) => r.name }
  const byN = (dir: 'asc' | 'desc'): SortState<Row> => ({ dir, value: (r) => r.n })

  it('returns input order when dir=none or state null', () => {
    expect(sortRows(rows, null).map((r) => r.id)).toEqual(['1', '2', '3'])
    expect(sortRows(rows, { dir: 'none', value: (r) => r.name }).map((r) => r.id)).toEqual(['1', '2', '3'])
  })

  it('sorts strings case-insensitively ascending', () => {
    expect(sortRows(rows, byName).map((r) => r.name)).toEqual(['alice', 'Bob', 'Charlie'])
  })

  it('sorts numbers numerically both directions', () => {
    expect(sortRows(rows, byN('asc')).map((r) => r.n)).toEqual([1, 2, 3])
    expect(sortRows(rows, byN('desc')).map((r) => r.n)).toEqual([3, 2, 1])
  })

  it('puts nil values last regardless of direction', () => {
    const byTenant = (dir: 'asc' | 'desc'): SortState<Row> => ({ dir, value: (r) => r.tenant })
    expect(sortRows(rows, byTenant('asc')).map((r) => r.tenant)).toEqual(['Acme', 'Beta', null])
    expect(sortRows(rows, byTenant('desc')).map((r) => r.tenant)).toEqual(['Beta', 'Acme', null])
  })

  it('is stable for equal keys', () => {
    const eq = [
      { id: 'a', name: 'x', n: 1, role: 'r' },
      { id: 'b', name: 'x', n: 1, role: 'r' },
      { id: 'c', name: 'x', n: 1, role: 'r' },
    ]
    expect(sortRows(eq, { dir: 'asc', value: (r) => r.name }).map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('does not mutate the input array', () => {
    const copy = [...rows]
    sortRows(rows, byName)
    expect(rows).toEqual(copy)
  })
})

describe('filterRows', () => {
  const keys = [(r: Row) => r.name, (r: Row) => r.role]

  it('returns all rows for empty/whitespace query', () => {
    expect(filterRows(rows, '', keys)).toHaveLength(3)
    expect(filterRows(rows, '   ', keys)).toHaveLength(3)
  })

  it('matches case-insensitively across fields (OR)', () => {
    expect(filterRows(rows, 'BO', keys).map((r) => r.id)).toEqual(['3']) // name Bob
    expect(filterRows(rows, 'admin', keys).map((r) => r.id)).toEqual(['2']) // role
  })

  it('trims the query and returns empty when nothing matches', () => {
    expect(filterRows(rows, '  zzz  ', keys)).toHaveLength(0)
  })
})

describe('applyFaceted', () => {
  const roleFacet = (selected: string[]) => ({ value: (r: Row) => r.role, selected })

  it('returns all rows when nothing selected', () => {
    expect(applyFaceted(rows, [roleFacet([])])).toHaveLength(3)
  })

  it('filters by a single selected value', () => {
    expect(applyFaceted(rows, [roleFacet(['admin'])]).map((r) => r.id)).toEqual(['2'])
  })

  it('OR within a facet (multiple selected)', () => {
    expect(applyFaceted(rows, [roleFacet(['admin', 'reader'])]).map((r) => r.id)).toEqual(['1', '2', '3'])
  })

  it('AND across facets', () => {
    const out = applyFaceted(rows, [
      roleFacet(['reader']),
      { value: (r: Row) => r.tenant ?? '', selected: ['Beta'] },
    ])
    expect(out.map((r) => r.id)).toEqual(['3'])
  })
})

describe('facetCounts', () => {
  it('counts rows per option value', () => {
    const c = facetCounts(rows, (r) => r.role)
    expect(c.get('reader')).toBe(2)
    expect(c.get('admin')).toBe(1)
  })
})

describe('pagination helpers', () => {
  const ten = Array.from({ length: 10 }, (_, i) => ({ id: String(i), name: 'x', n: i, role: 'r' }))

  it('pageRows slices the current page', () => {
    expect(pageRows(ten, { pageIndex: 0, pageSize: 3 }).map((r) => r.n)).toEqual([0, 1, 2])
    expect(pageRows(ten, { pageIndex: 3, pageSize: 3 }).map((r) => r.n)).toEqual([9])
  })

  it('pageCount is at least 1 and ceils', () => {
    expect(pageCount(0, 10)).toBe(1)
    expect(pageCount(10, 10)).toBe(1)
    expect(pageCount(11, 10)).toBe(2)
  })

  it('clampPageIndex keeps the index in range when rows shrink', () => {
    expect(clampPageIndex(5, 10, 3)).toBe(3) // 4 pages (0..3)
    expect(clampPageIndex(-1, 10, 3)).toBe(0)
    expect(clampPageIndex(2, 0, 3)).toBe(0)
  })
})
