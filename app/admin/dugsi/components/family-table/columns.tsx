'use client'

import { ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown, MoreHorizontal, Users, Eye, Trash2 } from 'lucide-react'

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
import { cn } from '@/lib/utils'
import { calculateDugsiRate } from '@/lib/utils/dugsi-tuition'

import { Family } from '../../_types'
import { getFamilyStatus } from '../../_utils/family'
import { formatParentName } from '../../_utils/format'
import { FamilyStatusBadge } from '../family-management/family-status-badge'
import { ShiftBadge } from '../shared/shift-badge'

interface ColumnActions {
  onViewDetails: (family: Family) => void
  onDelete: (family: Family) => void
}

function BillingCell({ family }: { family: Family }) {
  const member = family.members[0]
  if (!member) return null

  const subscriptionAmount = member.subscriptionAmount
  const familyChildCount = member.familyChildCount || family.members.length
  const expected = calculateDugsiRate(familyChildCount)

  const formatNoCents = (cents: number) => `$${Math.round(cents / 100)}`

  if (!subscriptionAmount) {
    return (
      <span className="text-xs text-muted-foreground">
        {formatNoCents(expected)} expected
      </span>
    )
  }

  const isMismatch = subscriptionAmount !== expected

  return (
    <span className="text-xs">
      <span className={cn(isMismatch ? 'text-amber-600' : 'text-foreground')}>
        {formatNoCents(subscriptionAmount)}
      </span>
      <span className="text-muted-foreground">
        {' '}
        / {formatNoCents(expected)}
      </span>
    </span>
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

export function createColumns(actions: ColumnActions): ColumnDef<Family>[] {
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
      accessorKey: 'parentName',
      header: ({ column }) => (
        <SortableHeader column={column}>Parent</SortableHeader>
      ),
      accessorFn: (row) =>
        formatParentName(
          row.members[0]?.parentFirstName,
          row.members[0]?.parentLastName
        ),
      cell: ({ row }) => {
        const member = row.original.members[0]
        return (
          <span className="font-medium">
            {formatParentName(member?.parentFirstName, member?.parentLastName)}
          </span>
        )
      },
    },
    {
      accessorKey: 'childCount',
      header: ({ column }) => (
        <SortableHeader column={column}>Kids</SortableHeader>
      ),
      accessorFn: (row) => row.members.length,
      cell: ({ row }) => (
        <Badge variant="secondary" className="gap-1">
          <Users className="h-3 w-3" />
          {row.original.members.length}
        </Badge>
      ),
    },
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <SortableHeader column={column}>Status</SortableHeader>
      ),
      accessorFn: (row) => {
        const status = getFamilyStatus(row)
        return status === 'active' ? 0 : status === 'no-payment' ? 1 : 2
      },
      cell: ({ row }) => {
        const status = getFamilyStatus(row.original)
        return <FamilyStatusBadge status={status} />
      },
    },
    {
      accessorKey: 'shift',
      header: ({ column }) => (
        <SortableHeader column={column}>Shift</SortableHeader>
      ),
      accessorFn: (row) => row.members[0]?.shift || 'ZZZ',
      cell: ({ row }) => (
        <ShiftBadge shift={row.original.members[0]?.shift ?? null} />
      ),
    },
    {
      accessorKey: 'teacher',
      header: ({ column }) => (
        <SortableHeader column={column}>Teacher</SortableHeader>
      ),
      accessorFn: (row) => row.members[0]?.teacherName || 'Unassigned',
      cell: ({ row }) => {
        const teacher = row.original.members[0]?.teacherName
        return (
          <span className={cn('text-sm', !teacher && 'text-muted-foreground')}>
            {teacher || 'Unassigned'}
          </span>
        )
      },
    },
    {
      accessorKey: 'billing',
      header: 'Billing',
      cell: ({ row }) => <BillingCell family={row.original} />,
      enableSorting: false,
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const family = row.original

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
                  actions.onViewDetails(family)
                }}
              >
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600"
                onClick={(e) => {
                  e.stopPropagation()
                  actions.onDelete(family)
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Family
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
      enableSorting: false,
    },
  ]
}
