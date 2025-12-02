'use client'

import { format } from 'date-fns'
import { Mail, Phone, Calendar, GraduationCap, Building2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { StudentStatus } from '@/lib/types/student'

import { MahadStudent } from '../../_types'

interface StudentDetailSheetProps {
  student: MahadStudent | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string | null
}) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm">{value}</p>
      </div>
    </div>
  )
}

export function StudentDetailSheet({
  student,
  open,
  onOpenChange,
}: StudentDetailSheetProps) {
  if (!student) return null

  const statusLabels: Record<StudentStatus, string> = {
    [StudentStatus.ENROLLED]: 'Enrolled',
    [StudentStatus.REGISTERED]: 'Registered',
    [StudentStatus.ON_LEAVE]: 'On Leave',
    [StudentStatus.WITHDRAWN]: 'Withdrawn',
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{student.name}</SheetTitle>
          <SheetDescription>
            <Badge variant="secondary">{statusLabels[student.status]}</Badge>
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Contact Information</h3>
            <div className="space-y-3">
              <InfoRow icon={Mail} label="Email" value={student.email} />
              <InfoRow icon={Phone} label="Phone" value={student.phone} />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Academic Information</h3>
            <div className="space-y-3">
              <InfoRow
                icon={Calendar}
                label="Date of Birth"
                value={
                  student.dateOfBirth
                    ? format(student.dateOfBirth, 'PPP')
                    : null
                }
              />
              <InfoRow
                icon={GraduationCap}
                label="Grade Level"
                value={student.gradeLevel}
              />
              <InfoRow
                icon={Building2}
                label="School"
                value={student.schoolName}
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Enrollment</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Batch</p>
                  <p className="text-sm">
                    {student.batch?.name || 'Unassigned'}
                  </p>
                </div>
              </div>
              {student.subscription && (
                <div>
                  <p className="text-xs text-muted-foreground">Subscription</p>
                  <p className="text-sm">
                    {student.subscription.status} - $
                    {student.subscription.amount / 100}/mo
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
