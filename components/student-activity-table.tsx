"use client"

import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  CheckCircle2Icon,
  LoaderIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { type RecentActivity } from "@/lib/db/queries/dashboard"

const columns: ColumnDef<RecentActivity>[] = [
  {
    accessorKey: "name",
    header: "Student Name",
    cell: ({ row }) => (
      <div className="font-medium">{row.getValue("name")}</div>
    ),
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => {
      const email = row.getValue("email") as string | null
      return (
        <div className="text-muted-foreground">
          {email || "Not provided"}
        </div>
      )
    },
  },
  {
    accessorKey: "batch",
    header: "Batch",
    cell: ({ row }) => {
      const batch = row.getValue("batch") as string | null
      return (
        <Badge variant="outline" className="text-muted-foreground px-1.5 w-fit">
          {batch || "Unassigned"}
        </Badge>
      )
    },
  },
  {
    accessorKey: "subscriptionStatus",
    header: "Subscription",
    cell: ({ row }) => {
      const status = row.getValue("subscriptionStatus") as string | null

      let displayText = status || "No subscription"

      switch (status) {
        case 'active':
          displayText = "Active"
          break
        case 'past_due':
          displayText = "Past Due"
          break
        case 'incomplete':
        case 'incomplete_expired':
          displayText = "Incomplete"
          break
        case 'canceled':
          displayText = "Canceled"
          break
      }

      return (
        <Badge
          variant="outline"
          className="inline-flex gap-1 px-1.5 text-muted-foreground [&_svg]:size-3 w-fit"
        >
          {status === 'active' ? (
            <CheckCircle2Icon className="text-green-500 dark:text-green-400" />
          ) : (
            <LoaderIcon />
          )}
          {displayText}
        </Badge>
      )
    },
  },
  {
    accessorKey: "paymentStatus",
    header: "Payment Status",
    cell: ({ row }) => {
      const status = row.getValue("paymentStatus") as RecentActivity['paymentStatus']
      const daysSince = row.original.daysSinceLastPayment

      let displayText = "No payment"

      switch (status) {
        case 'current':
          displayText = "Current"
          break
        case 'overdue':
          displayText = daysSince ? `Overdue (${daysSince}d)` : "Overdue"
          break
        case 'pending':
          displayText = "Pending"
          break
        case 'none':
          displayText = "No payment"
          break
      }

      return (
        <Badge
          variant="outline"
          className="inline-flex gap-1 px-1.5 text-muted-foreground [&_svg]:size-3 w-fit"
        >
          {status === 'current' ? (
            <CheckCircle2Icon className="text-green-500 dark:text-green-400" />
          ) : (
            <LoaderIcon />
          )}
          {displayText}
        </Badge>
      )
    },
  },
  {
    accessorKey: "lastPaymentDate",
    header: "Last Payment",
    cell: ({ row }) => {
      const date = row.getValue("lastPaymentDate") as Date | null
      if (!date) return <div className="text-muted-foreground">Never</div>

      return (
        <div className="text-muted-foreground">
          {new Date(date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </div>
      )
    },
  },
]

interface StudentActivityTableProps {
  data?: RecentActivity[]
}

export function StudentActivityTable({ data = [] }: StudentActivityTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [globalFilter, setGlobalFilter] = React.useState("")

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: "includesString",
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
    },
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  })

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <Input
          placeholder="Search students..."
          value={globalFilter ?? ""}
          onChange={(event) => setGlobalFilter(event.target.value)}
          className="max-w-sm"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-auto">
              Columns <ChevronDownIcon className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                )
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredRowModel().rows.length} of{" "}
          {data.length} student(s)
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronsLeftIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount()}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <ChevronsRightIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}