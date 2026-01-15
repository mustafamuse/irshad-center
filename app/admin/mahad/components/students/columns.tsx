'use client'

import { ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown, MoreHorizontal, Eye, Trash2, Link2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { MahadStudent, PaymentHealth } from '../../_types'
import { calculatePaymentHealth } from '../../_utils/grouping'

interface ColumnActions {
  onViewDetails: (student: MahadStudent) => void
  onDelete: (student: MahadStudent) => void
  onGeneratePaymentLink: (student: MahadStudent) => void
}

function getPaymentHealthBadge(health: PaymentHealth) {
  const configs: Record<PaymentHealth, { className: string; label: string }> = {
    needs_action: {
      className: 'bg-red-100 text-red-800 border-red-200',
      label: 'Needs Action',
    },
    at_risk: {
      className: 'bg-amber-100 text-amber-800 border-amber-200',
      label: 'At Risk',
    },
    healthy: {
      className: 'bg-green-100 text-green-800 border-green-200',
      label: 'Healthy',
    },
    exempt: {
      className: 'bg-slate-100 text-slate-800 border-slate-200',
      label: 'Exempt',
    },
    pending: {
      className: 'bg-blue-100 text-blue-800 border-blue-200',
      label: 'Pending',
    },
    inactive: {
      className: 'bg-gray-100 text-gray-600 border-gray-200',
      label: 'Inactive',
    },
  }
  const config = configs[health]
  return (
    <Badge className={`${config.className} font-medium`}>{config.label}</Badge>
  )
}

function SortableHeader({
  column,
  children,
}: {
  column: {
    toggleSorting: (desc?: boolean) => void
    getIsSorted: () => false | 'asc' | 'desc'
  }
  children: React.ReactNode
}) {
  return (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      className="-ml-4 h-8"
    >
      {children}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  )
}

export function createColumns(
  actions: ColumnActions
): ColumnDef<MahadStudent>[] {
  return [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <SortableHeader column={column}>Name</SortableHeader>
      ),
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name}</span>
      ),
    },
    {
      accessorKey: 'email',
      header: ({ column }) => (
        <SortableHeader column={column}>Email</SortableHeader>
      ),
      cell: ({ row }) => (
        <span className="hidden md:table-cell">
          {row.original.email || (
            <span className="text-muted-foreground">-</span>
          )}
        </span>
      ),
    },
    {
      accessorKey: 'batch',
      header: ({ column }) => (
        <SortableHeader column={column}>Batch</SortableHeader>
      ),
      accessorFn: (row) => row.batch?.name || 'ZZZ',
      cell: ({ row }) => (
        <span className="hidden sm:table-cell">
          {row.original.batch?.name || (
            <span className="text-muted-foreground">Unassigned</span>
          )}
        </span>
      ),
    },
    {
      accessorKey: 'paymentHealth',
      header: 'Payment',
      accessorFn: (row) => {
        const health = calculatePaymentHealth(row)
        const order: PaymentHealth[] = [
          'needs_action',
          'at_risk',
          'healthy',
          'exempt',
          'pending',
          'inactive',
        ]
        return order.indexOf(health)
      },
      cell: ({ row }) => {
        const health = calculatePaymentHealth(row.original)
        return getPaymentHealthBadge(health)
      },
      enableSorting: true,
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const student = row.original

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  actions.onViewDetails(student)
                }}
              >
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  actions.onGeneratePaymentLink(student)
                }}
              >
                <Link2 className="mr-2 h-4 w-4" />
                Generate Payment Link
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600"
                onClick={(e) => {
                  e.stopPropagation()
                  actions.onDelete(student)
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Student
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
      enableSorting: false,
    },
  ]
}
