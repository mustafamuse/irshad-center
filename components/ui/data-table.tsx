'use client'

import * as React from 'react'
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  SortingState,
  getSortedRowModel,
  RowSelectionState,
} from '@tanstack/react-table'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  onRowSelectionChange?: (selectedRows: TData[]) => void
  rowSelection?: RowSelectionState
  onRowSelectionStateChange?: (state: RowSelectionState) => void
}

export function DataTable<TData, TValue>({
  columns,
  data,
  onRowSelectionChange,
  rowSelection: externalRowSelection,
  onRowSelectionStateChange,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [internalRowSelection, setInternalRowSelection] =
    React.useState<RowSelectionState>({})

  // Use external row selection if provided, otherwise use internal
  const rowSelection = externalRowSelection ?? internalRowSelection

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    enableRowSelection: true,
    getRowId: (row, index) => (row as any).id ?? String(index),
    onRowSelectionChange: (updaterOrValue) => {
      const newValue =
        typeof updaterOrValue === 'function'
          ? updaterOrValue(rowSelection)
          : updaterOrValue

      // Update internal state if not controlled
      if (!externalRowSelection) {
        setInternalRowSelection(newValue)
      }

      // Call external handler if provided
      onRowSelectionStateChange?.(newValue)

      // Call the row selection change callback with actual row data
      if (onRowSelectionChange) {
        const selectedRows = Object.keys(newValue)
          .filter((key) => newValue[key])
          .map((rowId) => {
            // Find the row by ID (not index)
            return data.find((row) => {
              const id = (row as any).id ?? String(data.indexOf(row))
              return id === rowId
            })
          })
          .filter((row): row is TData => row !== undefined)
        onRowSelectionChange(selectedRows)
      }
    },
    state: {
      sorting,
      rowSelection,
    },
  })

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && 'selected'}
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
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
