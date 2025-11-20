'use client'

import { useState } from 'react'

import Link from 'next/link'

import { SubscriptionStatus } from '@prisma/client'
import { ColumnDef } from '@tanstack/react-table'
import { MoreHorizontal, Users } from 'lucide-react'

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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { BatchStudentData } from '@/lib/types/batch'
import { BatchWithCount } from '@/lib/types/batch'
import { StudentStatus, getStudentStatusDisplay } from '@/lib/types/student'
import { getSubscriptionStatusDisplay } from '@/lib/utils/subscription-status'

import { DeleteStudentDialog } from '../batches/delete-student-dialog'
import { CopyableText } from '../shared/ui/copyable-text'
import { PhoneContact } from '../shared/ui/phone-contact'

// Actions cell component that can use hooks
function StudentActionsCell({
  student,
  batches: _batches,
}: {
  student: BatchStudentData
  batches: BatchWithCount[]
}) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/admin/mahad/cohorts/students/${student.id}`}>
              View details
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link
              href={`/admin/mahad/cohorts/students/${student.id}?mode=edit`}
            >
              Edit student
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-red-600"
            onClick={() => {
              setDeleteDialogOpen(true)
            }}
          >
            Delete student
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteStudentDialog
        studentId={student.id}
        studentName={student.name}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
      />
    </>
  )
}

export function createStudentColumns(
  batches: BatchWithCount[]
): ColumnDef<BatchStudentData>[] {
  return [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => {
        const student = row.original
        return (
          <div className="max-w-[200px]">
            <div className="truncate font-medium" title={student.name}>
              {student.name}
            </div>
            {student.email && (
              <CopyableText
                text={student.email}
                label="email"
                className="text-sm text-muted-foreground"
              >
                <div className="truncate" title={student.email}>
                  {student.email}
                </div>
              </CopyableText>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'phone',
      header: 'Contact',
      cell: ({ row }) => {
        const phone = row.getValue('phone') as string
        const student = row.original
        return phone ? (
          <PhoneContact phone={phone} name={student.name} className="text-sm" />
        ) : (
          <span className="text-muted-foreground">-</span>
        )
      },
    },
    {
      accessorKey: 'Batch',
      header: 'Batch',
      cell: ({ row }) => {
        const student = row.original
        return student.Batch ? (
          <Badge variant="outline">{student.Batch.name}</Badge>
        ) : (
          <Badge variant="secondary">Unassigned</Badge>
        )
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.getValue('status') as StudentStatus
        return (
          <Badge
            variant={
              status === StudentStatus.ENROLLED ||
              status === StudentStatus.REGISTERED
                ? 'default'
                : 'secondary'
            }
          >
            {getStudentStatusDisplay(status)}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'subscriptionStatus',
      header: 'Subscription',
      cell: ({ row }) => {
        const status = row.getValue(
          'subscriptionStatus'
        ) as SubscriptionStatus | null
        if (!status) {
          return <span className="text-muted-foreground">-</span>
        }
        return (
          <Badge
            variant={
              status === 'active'
                ? 'default'
                : status === 'past_due'
                  ? 'destructive'
                  : 'secondary'
            }
          >
            {getSubscriptionStatusDisplay(status)}
          </Badge>
        )
      },
    },
    {
      id: 'siblings',
      header: () => (
        <div className="flex items-center justify-center">
          <Users className="h-4 w-4" />
        </div>
      ),
      cell: ({ row }) => {
        const student = row.original
        const activeSiblings =
          student.Sibling?.Student.filter(
            (sibling: { id: string; name: string; status: string | null }) =>
              sibling.id !== student.id &&
              (sibling.status === 'enrolled' || sibling.status === 'registered')
          ) || []

        if (activeSiblings.length === 0) {
          return (
            <div className="flex justify-center">
              <span className="text-muted-foreground">-</span>
            </div>
          )
        }

        return (
          <div className="flex justify-center">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 text-primary">
                    <Users className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {activeSiblings.length}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="space-y-1">
                    <p className="font-semibold">Active Siblings:</p>
                    {activeSiblings.map((sibling: { id: string; name: string; status: string | null }) => (
                      <p key={sibling.id} className="text-sm">
                        {sibling.name}
                      </p>
                    ))}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const student = row.original
        return <StudentActionsCell student={student} batches={batches} />
      },
    },
  ]
}
