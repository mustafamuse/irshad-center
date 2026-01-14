'use client'

import { useState } from 'react'

import { GraduationCap, Mail, MoreHorizontal, Phone, User } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { StudentStatus } from '@/lib/types/student'

import { StudentDetailSheet } from './student-detail-sheet'
import { MahadBatch, MahadStudent } from '../../_types'
import { useSelectedStudents, useMahadUIStore } from '../../store'
import { DeleteStudentDialog } from '../dialogs/delete-student-dialog'
import { PaymentLinkDialog } from '../dialogs/payment-link-dialog'

interface StudentsMobileCardsProps {
  students: MahadStudent[]
  batches: MahadBatch[]
}

function getStatusConfig(status: StudentStatus) {
  const configs: Record<StudentStatus, { className: string; label: string }> = {
    [StudentStatus.ENROLLED]: {
      className: 'bg-green-100 text-green-800 border-green-200',
      label: 'Enrolled',
    },
    [StudentStatus.REGISTERED]: {
      className: 'bg-blue-100 text-blue-800 border-blue-200',
      label: 'Registered',
    },
    [StudentStatus.ON_LEAVE]: {
      className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      label: 'On Leave',
    },
    [StudentStatus.WITHDRAWN]: {
      className: 'bg-red-100 text-red-800 border-red-200',
      label: 'Withdrawn',
    },
  }
  return (
    configs[status] || {
      className: 'bg-muted text-muted-foreground',
      label: status,
    }
  )
}

export function StudentsMobileCards({
  students,
  batches,
}: StudentsMobileCardsProps) {
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
  const { toggleStudent } = useMahadUIStore()

  if (students.length === 0) {
    return (
      <div className="px-4 py-6">
        <Card className="border border-dashed border-border bg-muted/50">
          <CardContent className="flex flex-col items-center justify-center space-y-4 py-16">
            <div className="rounded-full bg-muted p-4">
              <User className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-2 text-center">
              <h3 className="text-lg font-medium text-card-foreground">
                No students found
              </h3>
              <p className="max-w-sm text-sm text-muted-foreground">
                Try adjusting your filters or add new students.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3 py-2">
        {students.map((student) => {
          const statusConfig = getStatusConfig(student.status)
          const isSelected = selectedIds.has(student.id)

          return (
            <Card
              key={student.id}
              className="border-border bg-card shadow-sm transition-all duration-200 hover:shadow-md active:scale-[0.98]"
              onClick={() => setSelectedStudentId(student.id)}
            >
              <CardContent className="p-4">
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex flex-1 items-center space-x-3">
                    <div
                      className="flex-shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleStudent(student.id)}
                        aria-label={`Select ${student.name}`}
                        className="h-5 w-5"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-semibold leading-tight text-card-foreground">
                        {student.name}
                      </h3>
                      {student.batch && (
                        <div className="mt-1 flex items-center">
                          <GraduationCap className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm font-medium text-muted-foreground">
                            {student.batch.name}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <Badge
                    className={`${statusConfig.className} flex-shrink-0 px-2.5 py-1 text-xs font-medium`}
                  >
                    {statusConfig.label}
                  </Badge>
                </div>

                <div className="mb-4 space-y-2 rounded-lg bg-muted/50 p-3">
                  {student.email ? (
                    <div className="flex items-center space-x-2">
                      <Mail className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                      <span className="truncate text-sm font-medium text-card-foreground">
                        {student.email}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <Mail className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/50" />
                      <span className="text-sm italic text-muted-foreground">
                        No email
                      </span>
                    </div>
                  )}
                  {student.phone ? (
                    <div className="flex items-center space-x-2">
                      <Phone className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                      <span className="text-sm font-medium text-card-foreground">
                        {student.phone}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <Phone className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/50" />
                      <span className="text-sm italic text-muted-foreground">
                        No phone
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {student.subscription ? (
                      <Badge
                        variant="outline"
                        className="px-2 py-0.5 text-xs font-medium"
                      >
                        {student.subscription.status}
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                      >
                        No subscription
                      </Badge>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      asChild
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button variant="outline" size="sm" className="h-8 px-3">
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
                </div>
              </CardContent>
            </Card>
          )
        })}
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
