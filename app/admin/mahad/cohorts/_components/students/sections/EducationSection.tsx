import { BookOpen, DollarSign, GraduationCap, School } from 'lucide-react'

import type { BatchStudentData, StudentDetailData } from '@/lib/types/batch'

import {
  formatGradeLevel,
  formatGraduationStatus,
  formatBillingType,
} from '../../../_lib/student-form-utils'
import type { StudentFormData } from '../../../_types/student-form'
import { StudentSelectField } from '../fields/StudentSelectField'
import { StudentTextField } from '../fields/StudentTextField'

interface EducationSectionProps {
  student: BatchStudentData | StudentDetailData
  formData: StudentFormData
  isEditing: boolean
  isPending: boolean
  updateField: <K extends keyof StudentFormData>(
    field: K,
    value: StudentFormData[K]
  ) => void
}

const GRADUATION_STATUS_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'NON_GRADUATE', label: 'Non-Graduate (Still in School)' },
  { value: 'GRADUATE', label: 'Graduate' },
]

const BILLING_TYPE_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'FULL_TIME', label: 'Full-Time' },
  { value: 'FULL_TIME_SCHOLARSHIP', label: 'Full-Time (Scholarship)' },
  { value: 'PART_TIME', label: 'Part-Time' },
  { value: 'EXEMPT', label: 'Exempt' },
]

const PAYMENT_FREQUENCY_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'BI_MONTHLY', label: 'Bi-Monthly (Every 2 Months)' },
]

const GRADE_LEVEL_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'KINDERGARTEN', label: 'Kindergarten' },
  ...Array.from({ length: 12 }, (_, i) => ({
    value: `GRADE_${i + 1}`,
    label: `Grade ${i + 1}`,
  })),
  { value: 'FRESHMAN', label: 'Freshman' },
  { value: 'SOPHOMORE', label: 'Sophomore' },
  { value: 'JUNIOR', label: 'Junior' },
  { value: 'SENIOR', label: 'Senior' },
]

export function EducationSection({
  student,
  formData,
  isEditing,
  isPending,
  updateField,
}: EducationSectionProps) {
  return (
    <div className="space-y-4 border-t pt-6">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <DollarSign className="h-4 w-4" />
        Billing Configuration
      </h3>

      <div className="space-y-3">
        <StudentSelectField
          id="graduationStatus"
          label="Graduation Status"
          value={formData.graduationStatus}
          options={GRADUATION_STATUS_OPTIONS}
          isEditing={isEditing}
          onChange={(value) => updateField('graduationStatus', value)}
          disabled={isPending}
          icon={GraduationCap}
          displayValue={formatGraduationStatus(
            student.graduationStatus ?? null
          )}
          placeholder="Select graduation status"
        />

        <StudentSelectField
          id="billingType"
          label="Billing Type"
          value={formData.billingType}
          options={BILLING_TYPE_OPTIONS}
          isEditing={isEditing}
          onChange={(value) => updateField('billingType', value)}
          disabled={isPending}
          icon={DollarSign}
          displayValue={formatBillingType(student.billingType ?? null)}
          placeholder="Select billing type"
        />

        <StudentSelectField
          id="paymentFrequency"
          label="Payment Frequency"
          value={formData.paymentFrequency}
          options={PAYMENT_FREQUENCY_OPTIONS}
          isEditing={isEditing}
          onChange={(value) => updateField('paymentFrequency', value)}
          disabled={isPending}
          icon={BookOpen}
          displayValue={
            student.paymentFrequency === 'MONTHLY'
              ? 'Monthly'
              : student.paymentFrequency === 'BI_MONTHLY'
                ? 'Bi-Monthly'
                : '—'
          }
          placeholder="Select payment frequency"
        />

        <StudentSelectField
          id="gradeLevel"
          label="Grade Level"
          value={formData.gradeLevel}
          options={GRADE_LEVEL_OPTIONS}
          isEditing={isEditing}
          onChange={(value) => updateField('gradeLevel', value)}
          disabled={isPending}
          icon={School}
          displayValue={formatGradeLevel(student.gradeLevel ?? null)}
          placeholder="Select grade level"
        />

        <StudentTextField
          id="schoolName"
          label="School Name"
          value={formData.schoolName}
          isEditing={isEditing}
          onChange={(value) => updateField('schoolName', value)}
          disabled={isPending}
        />

        <StudentTextField
          id="paymentNotes"
          label="Payment Notes"
          value={formData.paymentNotes}
          isEditing={isEditing}
          onChange={(value) => updateField('paymentNotes', value)}
          disabled={isPending}
        />
      </div>
    </div>
  )
}
