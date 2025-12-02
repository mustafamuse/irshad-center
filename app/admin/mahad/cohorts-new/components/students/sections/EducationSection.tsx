import { BookOpen, DollarSign, GraduationCap, School } from 'lucide-react'

import type { BatchStudentData, StudentDetailData } from '@/lib/types/batch'

import {
  formatBillingType,
  formatGradeLevel,
  formatGraduationStatus,
} from '../../../_lib/student-form-utils'
import type { StudentFormData } from '../../../_types'
import {
  BILLING_TYPE_OPTIONS,
  GRADE_LEVEL_OPTIONS,
  GRADUATION_STATUS_OPTIONS,
  PAYMENT_FREQUENCY_OPTIONS,
} from '../../../constants/form-options'
import { StudentSelectField } from '../fields/StudentSelectField'
import { StudentTextField } from '../fields/StudentTextField'

interface EducationSectionProps {
  /** Student data to display/edit */
  student: BatchStudentData | StudentDetailData
  /** Current form data state */
  formData: StudentFormData
  /** Whether the form is in edit mode */
  isEditing: boolean
  /** Whether a save operation is pending */
  isPending: boolean
  /** Callback to update a form field */
  updateField: <K extends keyof StudentFormData>(
    field: K,
    value: StudentFormData[K]
  ) => void
}

/**
 * EducationSection - Form section for billing and education configuration
 *
 * Displays graduation status, billing type, payment frequency, grade level,
 * school name, and payment notes. Supports both view and edit modes.
 */
export function EducationSection({
  student,
  formData,
  isEditing,
  isPending,
  updateField,
}: EducationSectionProps) {
  return (
    <div className="space-y-3 border-t pt-4 sm:space-y-4 sm:pt-6">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <DollarSign className="h-4 w-4" />
        Billing Configuration
      </h3>

      <div className="space-y-2 sm:space-y-3">
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
