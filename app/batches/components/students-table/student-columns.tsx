'use client'

import { useState } from 'react'

import { ColumnDef } from '@tanstack/react-table'
import { MoreHorizontal } from 'lucide-react'

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
import { BatchStudentData } from '@/lib/types/batch'
import { BatchWithCount } from '@/lib/types/batch'
import { StudentStatus, getStudentStatusDisplay } from '@/lib/types/student'

import { StudentDetailsSheet } from './student-details-sheet'
import { DeleteStudentDialog } from '../batch-management/delete-student-dialog'
import { CopyableText } from '../ui/copyable-text'
import { PhoneContact } from '../ui/phone-contact'

// Actions cell component that can use hooks
function StudentActionsCell({
  student,
  batches,
}: {
  student: BatchStudentData
  batches: BatchWithCount[]
}) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [detailsSheetOpen, setDetailsSheetOpen] = useState(false)
  const [detailsSheetMode, setDetailsSheetMode] = useState<'view' | 'edit'>(
    'view'
  )

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
          <DropdownMenuItem
            onClick={() => {
              setDetailsSheetMode('view')
              setDetailsSheetOpen(true)
            }}
          >
            View details
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setDetailsSheetMode('edit')
              setDetailsSheetOpen(true)
            }}
          >
            Edit student
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

      <StudentDetailsSheet
        student={student}
        batches={batches}
        open={detailsSheetOpen}
        mode={detailsSheetMode}
        onOpenChange={setDetailsSheetOpen}
        onModeChange={setDetailsSheetMode}
      />

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
      header: 'Phone',
      cell: ({ row }) => {
        const phone = row.getValue('phone') as string
        const student = row.original
        return phone ? (
          <PhoneContact
            phone={phone}
            name={student.name}
            compact
            className="text-sm"
          />
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
      accessorKey: 'educationLevel',
      header: 'Education',
      cell: ({ row }) => {
        const level = row.getValue('educationLevel') as string
        return level ? (
          <span className="text-sm">{level}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )
      },
    },
    {
      accessorKey: 'gradeLevel',
      header: 'Grade',
      cell: ({ row }) => {
        const grade = row.getValue('gradeLevel') as string
        return grade ? (
          <span className="text-sm">{grade}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
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
