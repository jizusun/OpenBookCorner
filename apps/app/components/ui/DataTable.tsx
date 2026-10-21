import { useMemo, useState, type ReactNode } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  type RowSelectionState,
  type Table as RTTable,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ChevronsUpDown, Settings2, Check, X, PlusCircle } from 'lucide-react'
import { Trans } from '@lingui/react/macro'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface Column<T> {
  /** Stable column id (defaults to `col<index>`). Needed for sort/visibility/facets. */
  id?: string
  header: ReactNode
  cell: (row: T) => ReactNode
  muted?: boolean
  srHeader?: boolean
  /** Enable client-side sorting on this column. */
  sortable?: boolean
  /** Value used for sorting (string → locale, number → numeric). */
  sortValue?: (row: T) => string | number | null | undefined
  /** Can this column be hidden via the View menu? Default: true when `id` is set. */
  hideable?: boolean
}

export interface FacetedFilter<T> {
  /** Must match a Column.id. */
  columnId: string
  label: ReactNode
  /** Row → facet value (used for filtering + counts). */
  value: (row: T) => string
  options: { value: string; label: ReactNode }[]
}

export interface BulkAction<T> {
  key: string
  label: ReactNode
  onClick: (selected: T[]) => void
  testId?: string
  variant?: 'default' | 'destructive' | 'outline' | 'ghost'
}

export interface DataTableProps<T> {
  rows: T[]
  loading: boolean
  columns: Column<T>[]
  rowKey: (row: T) => string
  rowTestId?: (row: T) => string
  testId: string
  empty: { icon: string; title: ReactNode; description?: ReactNode }
  skeletonRows?: number
  toolbar?: {
    search?: { placeholder?: string; keys: Array<(row: T) => unknown>; ariaLabel?: string }
    faceted?: FacetedFilter<T>[]
  }
  enableColumnVisibility?: boolean
  enablePagination?: boolean
  pageSize?: number
  enableRowSelection?: boolean
  bulkActions?: BulkAction<T>[]
}

const PAGE_SIZES = [10, 20, 50, 100]
const colId = <T,>(c: Column<T>, i: number) => c.id ?? `col${i}`

export function DataTable<T>(props: DataTableProps<T>) {
  const {
    rows,
    loading,
    columns,
    rowKey,
    rowTestId,
    testId,
    empty,
    skeletonRows = 3,
    toolbar,
    enableColumnVisibility,
    enablePagination,
    pageSize = 20,
    enableRowSelection,
    bulkActions,
  } = props

  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const faceted = toolbar?.faceted ?? []
  const facetValueById = useMemo(() => {
    const m = new Map<string, (row: T) => string>()
    for (const f of toolbar?.faceted ?? []) m.set(f.columnId, f.value)
    return m
  }, [toolbar?.faceted])

  const tableColumns = useMemo<ColumnDef<T>[]>(() => {
    const defs: ColumnDef<T>[] = []

    if (enableRowSelection) {
      defs.push({
        id: '__select',
        enableSorting: false,
        enableHiding: false,
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && 'indeterminate')
            }
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            aria-label="Select all"
            data-testid={`${testId}-select-all`}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
            aria-label="Select row"
            data-testid={`${testId}-select-${rowKey(row.original)}`}
          />
        ),
      })
    }

    columns.forEach((c, i) => {
      const id = colId(c, i)
      const facetVal = facetValueById.get(id)
      defs.push({
        id,
        enableSorting: !!c.sortable,
        enableHiding: c.hideable ?? !!c.id,
        // accessor only matters for sort/filter; cell rendering uses c.cell.
        accessorFn: (row) => (facetVal ? facetVal(row) : c.sortValue?.(row) ?? ''),
        sortingFn: (a, b) => {
          const av = (c.sortValue?.(a.original) ?? '') as string | number
          const bv = (c.sortValue?.(b.original) ?? '') as string | number
          if (typeof av === 'number' && typeof bv === 'number') return av - bv
          return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' })
        },
        filterFn: facetVal
          ? (row, columnId, filterValue: string[]) =>
              !filterValue?.length || filterValue.includes(String(row.getValue(columnId)))
          : 'includesString',
        header: () => (c.srHeader ? <span className="sr-only">{c.header}</span> : <>{c.header}</>),
        cell: ({ row }) => c.cell(row.original),
        meta: { muted: c.muted },
      })
    })
    return defs
  }, [columns, enableRowSelection, testId, facetValueById])

  const table = useReactTable({
    data: rows,
    columns: tableColumns,
    state: { sorting, columnFilters, globalFilter, columnVisibility, rowSelection },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: !!enableRowSelection,
    getRowId: (r) => rowKey(r),
    globalFilterFn: (row, _col, value) => {
      const keys = toolbar?.search?.keys
      const q = String(value ?? '').trim().toLowerCase()
      if (!keys || !q) return true
      return keys.some((k) => {
        const v = k(row.original)
        return v != null && String(v).toLowerCase().includes(q)
      })
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    ...(enablePagination ? { getPaginationRowModel: getPaginationRowModel() } : {}),
    initialState: enablePagination ? { pagination: { pageSize, pageIndex: 0 } } : {},
  })

  if (loading) {
    return (
      <div className="space-y-2" data-testid={`${testId}-loading`}>
        {Array.from({ length: skeletonRows }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  const hasToolbar = !!(toolbar?.search || faceted.length || enableColumnVisibility)
  const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original)

  return (
    <div className="space-y-3">
      {hasToolbar && (
        <Toolbar
          table={table}
          testId={testId}
          search={toolbar?.search}
          faceted={faceted}
          allRows={rows}
          enableColumnVisibility={enableColumnVisibility}
          columns={columns}
        />
      )}

      {enableRowSelection && selectedRows.length > 0 && (
        <BulkBar
          count={selectedRows.length}
          actions={bulkActions ?? []}
          selected={selectedRows}
          onClear={() => table.resetRowSelection()}
          testId={testId}
        />
      )}

      <VisibleTable table={table} testId={testId} rowTestId={rowTestId} empty={empty} />

      {enablePagination && <Pagination table={table} testId={testId} />}
    </div>
  )
}

/* ---------------- subcomponents ---------------- */

type AnyTable<T> = RTTable<T>

function Toolbar<T>({
  table,
  testId,
  search,
  faceted,
  allRows,
  enableColumnVisibility,
  columns,
}: {
  table: AnyTable<T>
  testId: string
  search?: { placeholder?: string; keys: Array<(row: T) => unknown>; ariaLabel?: string }
  faceted: FacetedFilter<T>[]
  allRows: T[]
  enableColumnVisibility?: boolean
  columns: Column<T>[]
}) {
  const globalFilter = (table.getState().globalFilter as string) ?? ''
  const anyFacetActive = faceted.some(
    (f) => ((table.getColumn(f.columnId)?.getFilterValue() as string[]) ?? []).length > 0,
  )
  const isFiltered = globalFilter.trim().length > 0 || anyFacetActive

  return (
    <div className="flex flex-wrap items-center gap-2">
      {search && (
        <Input
          value={globalFilter}
          onChange={(e) => table.setGlobalFilter(e.target.value)}
          placeholder={search.placeholder}
          aria-label={search.ariaLabel ?? search.placeholder}
          className="h-8 w-[200px]"
          data-testid={`${testId}-search`}
        />
      )}

      {faceted.map((f) => (
        <FacetedFilterButton key={f.columnId} table={table} facet={f} allRows={allRows} testId={testId} />
      ))}

      {isFiltered && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            table.setGlobalFilter('')
            faceted.forEach((f) => table.getColumn(f.columnId)?.setFilterValue(undefined))
          }}
          data-testid={`${testId}-reset`}
        >
          <X className="size-4" />
          <Trans>Reset</Trans>
        </Button>
      )}

      {enableColumnVisibility && (
        <div className="ml-auto">
          <ViewOptions table={table} columns={columns} testId={testId} />
        </div>
      )}
    </div>
  )
}

function FacetedFilterButton<T>({
  table,
  facet,
  allRows,
  testId,
}: {
  table: AnyTable<T>
  facet: FacetedFilter<T>
  allRows: T[]
  testId: string
}) {
  const col = table.getColumn(facet.columnId)
  const selected = (col?.getFilterValue() as string[]) ?? []
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of allRows) {
      const v = facet.value(r)
      m.set(v, (m.get(v) ?? 0) + 1)
    }
    return m
  }, [allRows, facet])

  const toggle = (value: string) => {
    const next = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value]
    col?.setFilterValue(next.length ? next : undefined)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 border-dashed" data-testid={`${testId}-facet-${facet.columnId}`}>
          <PlusCircle className="size-4" />
          {facet.label}
          {selected.length > 0 && (
            <>
              <span className="mx-1 h-4 w-px bg-border" />
              <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                {selected.length}
              </Badge>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-0" align="start">
        <Command>
          <CommandInput placeholder={undefined} />
          <CommandList>
            <CommandEmpty>
              <Trans>No results.</Trans>
            </CommandEmpty>
            <CommandGroup>
              {facet.options.map((opt) => {
                const isSel = selected.includes(opt.value)
                return (
                  <CommandItem
                    key={opt.value}
                    onSelect={() => toggle(opt.value)}
                    data-testid={`${testId}-facet-${facet.columnId}-opt-${opt.value}`}
                  >
                    <div
                      className={cn(
                        'flex size-4 items-center justify-center rounded-sm border',
                        isSel ? 'bg-primary text-primary-foreground' : 'opacity-50',
                      )}
                    >
                      {isSel && <Check className="size-3" />}
                    </div>
                    <span className="flex-1">{opt.label}</span>
                    <span className="text-xs text-muted-foreground">{counts.get(opt.value) ?? 0}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function ViewOptions<T>({
  table,
  columns,
  testId,
}: {
  table: AnyTable<T>
  columns: Column<T>[]
  testId: string
}) {
  const labelFor = (id: string) => {
    const idx = columns.findIndex((c, i) => colId(c, i) === id)
    return idx >= 0 ? columns[idx]!.header : id
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className="h-8" data-testid={`${testId}-view-options`}>
          <Settings2 className="size-4" />
          <Trans>View</Trans>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>
          <Trans>Toggle columns</Trans>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {table
          .getAllColumns()
          .filter((c) => c.getCanHide() && c.id !== '__select')
          .map((c) => (
            <DropdownMenuCheckboxItem
              key={c.id}
              checked={c.getIsVisible()}
              onCheckedChange={(v) => c.toggleVisibility(!!v)}
              data-testid={`${testId}-toggle-${c.id}`}
            >
              {labelFor(c.id)}
            </DropdownMenuCheckboxItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SortHeader<T>({ table, columnId, children }: { table: AnyTable<T>; columnId: string; children: ReactNode }) {
  const col = table.getColumn(columnId)
  if (!col || !col.getCanSort()) return <>{children}</>
  const sorted = col.getIsSorted()
  return (
    <button
      type="button"
      className="-ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-accent/60"
      onClick={() => col.toggleSorting()}
      data-testid={`sort-${columnId}`}
    >
      {children}
      {sorted === 'asc' ? (
        <ArrowUp className="size-3.5" />
      ) : sorted === 'desc' ? (
        <ArrowDown className="size-3.5" />
      ) : (
        <ChevronsUpDown className="size-3.5 opacity-50" />
      )}
    </button>
  )
}

function VisibleTable<T>({
  table,
  testId,
  rowTestId,
  empty,
}: {
  table: AnyTable<T>
  testId: string
  rowTestId?: (row: T) => string
  empty: { icon: string; title: ReactNode; description?: ReactNode }
}) {
  const rowModel = table.getRowModel()
  if (rowModel.rows.length === 0) {
    return (
      <div data-testid={`${testId}-empty`}>
        <EmptyState icon={empty.icon} title={empty.title} description={empty.description} />
      </div>
    )
  }
  return (
    <div className="overflow-x-auto rounded-md border" data-testid={`${testId}-table`}>
      <Table className="text-sm">
        <TableHeader className="bg-muted/50">
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => {
                const node = flexRender(h.column.columnDef.header, h.getContext())
                const sorted = h.column.getIsSorted()
                return (
                  <TableHead
                    key={h.id}
                    className="font-medium text-muted-foreground"
                    aria-sort={
                      !h.column.getCanSort()
                        ? undefined
                        : sorted === 'asc'
                          ? 'ascending'
                          : sorted === 'desc'
                            ? 'descending'
                            : 'none'
                    }
                  >
                    {h.column.getCanSort() ? (
                      <SortHeader table={table} columnId={h.column.id}>
                        {node}
                      </SortHeader>
                    ) : (
                      node
                    )}
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rowModel.rows.map((row) => (
            <TableRow
              key={row.id}
              data-state={row.getIsSelected() ? 'selected' : undefined}
              data-testid={rowTestId?.(row.original)}
              className="hover:bg-accent/40"
            >
              {row.getVisibleCells().map((cell) => {
                const muted = (cell.column.columnDef.meta as { muted?: boolean } | undefined)?.muted
                return (
                  <TableCell key={cell.id} className={cn(muted && 'text-muted-foreground')}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                )
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function Pagination<T>({ table, testId }: { table: AnyTable<T>; testId: string }) {
  const pageNum = table.getState().pagination.pageIndex + 1
  const pageTotal = table.getPageCount()
  return (
    <div className="flex items-center justify-between gap-2" data-testid={`${testId}-pagination`}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>
          <Trans>Rows per page</Trans>
        </span>
        <Select
          value={String(table.getState().pagination.pageSize)}
          onValueChange={(v) => table.setPageSize(Number(v))}
        >
          <SelectTrigger className="h-8 w-[72px]" data-testid={`${testId}-page-size`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((s) => (
              <SelectItem key={s} value={String(s)}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <span data-testid={`${testId}-page-indicator`}>
          <Trans>
            Page {pageNum} of {pageTotal}
          </Trans>
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          data-testid={`${testId}-prev`}
        >
          <Trans>Previous</Trans>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          data-testid={`${testId}-next`}
        >
          <Trans>Next</Trans>
        </Button>
      </div>
    </div>
  )
}

function BulkBar<T>({
  count,
  actions,
  selected,
  onClear,
  testId,
}: {
  count: number
  actions: BulkAction<T>[]
  selected: T[]
  onClear: () => void
  testId: string
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-md border bg-muted/40 px-3 py-2 text-sm"
      data-testid={`${testId}-bulk-bar`}
    >
      <span data-testid={`${testId}-bulk-count`}>
        <Trans>{count} selected</Trans>
      </span>
      <div className="ml-auto flex items-center gap-2">
        {actions.map((a) => (
          <Button
            key={a.key}
            size="sm"
            variant={a.variant ?? 'outline'}
            onClick={() => a.onClick(selected)}
            data-testid={a.testId ?? `${testId}-bulk-${a.key}`}
          >
            {a.label}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={onClear} data-testid={`${testId}-bulk-clear`}>
          <X className="size-4" />
          <Trans>Clear</Trans>
        </Button>
      </div>
    </div>
  )
}
