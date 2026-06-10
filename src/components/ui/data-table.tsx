import {
  type Column,
  type ColumnDef,
  type ColumnFiltersColumn,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  type Table as TanstackTable,
  useReactTable,
} from "@tanstack/react-table"
import { ArrowDown, ArrowUp } from "lucide-react"
import { useState } from "react"

import { Button } from "#/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table"

export function SortableHeader<TData, TValue>({
  column,
  label,
}: {
  column: Column<TData, TValue>
  label: string
}) {
  const sorted = column.getIsSorted()
  const Icon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : null
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8"
      onClick={() => column.toggleSorting(sorted === "asc")}
    >
      {label}
      {Icon && <Icon className="ml-2 h-4 w-4" />}
    </Button>
  )
}

export function FilterableHeader<TData>({
  column,
  disabled,
  items,
}: {
  column: ColumnFiltersColumn<TData>
  disabled: boolean
  items: { label: string; value: string }[]
}) {
  const current = column?.getFilterValue() ?? "all"

  return (
    <Select
      value={current}
      onValueChange={(v) => column?.setFilterValue(v === "all" ? undefined : v)}
      disabled={disabled}
      items={items}
    >
      <SelectTrigger size="sm" className="w-28 border-none shadow-none">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  isLoading?: boolean
  toolbar?: (table: TanstackTable<TData>) => React.ReactNode
  onRowClick?: (row: TData) => void
}

export function DataTable<TData, TValue>({
  columns,
  data,
  isLoading,
  toolbar,
  onRowClick,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <div>
      {toolbar?.(table)}
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={onRowClick ? "cursor-pointer" : undefined}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
