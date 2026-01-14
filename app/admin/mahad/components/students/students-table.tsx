'use client'

import { useState } from 'react'

import { MoreHorizontal, User } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { StudentDetailSheet } from './student-detail-sheet'
import { MahadBatch, MahadStudent, PaymentHealth } from '../../_types'
import { calculatePaymentHealth } from '../../_utils/grouping'
import { useSelectedStudents, useMahadUIStore } from '../../store'
import { DeleteStudentDialog } from '../dialogs/delete-student-dialog'
import { PaymentLinkDialog } from '../dialogs/payment-link-dialog'

interface StudentsTableProps {
  students: MahadStudent[]
  batches: MahadBatch[]
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

export function StudentsTable({ students, batches }: StudentsTableProps) {
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    null
  )
  const [paymentLinkStudentId, setPaymentLinkStudentId] = useState<
    string | null
  >(null)
  const [deleteStudentId, setDeleteStudentId] = useState<string | null>(null)

  const selectedStudent = selectedStudentId
    ? (students.find((s) => s.id === selectedStudentId) ?? null)
    : null
  const paymentLinkStudent = paymentLinkStudentId
    ? (students.find((s) => s.id === paymentLinkStudentId) ?? null)
    : null
  const deleteStudent = deleteStudentId
    ? (students.find((s) => s.id === deleteStudentId) ?? null)
    : null
  const selectedIds = useSelectedStudents()
  const { toggleStudent, setSelected, clearSelected } = useMahadUIStore()

  const allSelected =
    students.length > 0 && students.every((s) => selectedIds.has(s.id))
  const someSelected = students.some((s) => selectedIds.has(s.id))

  const handleSelectAll = () => {
    if (allSelected) {
      clearSelected()
    } else {
      setSelected(students.map((s) => s.id))
    }
  }

  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <User className="h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">No students found</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Try adjusting your filters or add new students.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={allSelected}
                  ref={(el) => {
                    if (el)
                      (el as HTMLInputElement).indeterminate =
                        someSelected && !allSelected
                  }}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all students"
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Email</TableHead>
              <TableHead className="hidden sm:table-cell">Batch</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((student) => (
              <TableRow
                key={student.id}
                className="cursor-pointer"
                onClick={() => setSelectedStudentId(student.id)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.has(student.id)}
                    onCheckedChange={() => toggleStudent(student.id)}
                    aria-label={`Select ${student.name}`}
                  />
                </TableCell>
                <TableCell className="font-medium">{student.name}</TableCell>
                <TableCell className="hidden md:table-cell">
                  {student.email || '-'}
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  {student.batch?.name || (
                    <span className="text-muted-foreground">Unassigned</span>
                  )}
                </TableCell>
                <TableCell>
                  {getPaymentHealthBadge(calculatePaymentHealth(student))}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => setSelectedStudentId(student.id)}
                      >
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setPaymentLinkStudentId(student.id)}
                      >
                        Generate Payment Link
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDeleteStudentId(student.id)}
                      >
                        Delete Student
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <StudentDetailSheet
        student={selectedStudent}
        batches={batches}
        open={!!selectedStudent}
        onOpenChange={(open) => !open && setSelectedStudentId(null)}
      />

      <PaymentLinkDialog
        profileId={paymentLinkStudent?.id ?? ''}
        studentName={paymentLinkStudent?.name ?? ''}
        open={!!paymentLinkStudent}
        onOpenChange={(open) => !open && setPaymentLinkStudentId(null)}
      />

      <DeleteStudentDialog
        studentId={deleteStudent?.id ?? ''}
        studentName={deleteStudent?.name ?? ''}
        open={!!deleteStudent}
        onOpenChange={(open) => !open && setDeleteStudentId(null)}
        onDeleted={() => setDeleteStudentId(null)}
      />
    </>
  )
}
