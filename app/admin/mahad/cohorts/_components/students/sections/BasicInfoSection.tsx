import { Mail, Phone as PhoneIcon, Users } from 'lucide-react'

import type { BatchStudentData, StudentDetailData } from '@/lib/types/batch'

import type { StudentFormData } from '../../../_types/student-form'
import { StudentDateField } from '../fields/StudentDateField'
import { StudentTextField } from '../fields/StudentTextField'

interface BasicInfoSectionProps {
  student: BatchStudentData | StudentDetailData
  formData: StudentFormData
  isEditing: boolean
  isPending: boolean
  updateField: <K extends keyof StudentFormData>(
    field: K,
    value: StudentFormData[K]
  ) => void
}

export function BasicInfoSection({
  student,
  formData,
  isEditing,
  isPending,
  updateField,
}: BasicInfoSectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Users className="h-4 w-4" />
        Basic Information
      </h3>

      <div className="space-y-3">
        <StudentTextField
          id="name"
          label="Name"
          value={formData.name}
          isEditing={isEditing}
          onChange={(value) => updateField('name', value)}
          disabled={isPending}
          required
        />

        <StudentTextField
          id="email"
          label="Email"
          value={formData.email}
          isEditing={isEditing}
          onChange={(value) => updateField('email', value)}
          disabled={isPending}
          type="email"
          icon={Mail}
          href={student.email ? `mailto:${student.email}` : undefined}
        />

        <StudentTextField
          id="phone"
          label="Phone"
          value={formData.phone}
          isEditing={isEditing}
          onChange={(value) => updateField('phone', value)}
          disabled={isPending}
          type="tel"
          icon={PhoneIcon}
          href={student.phone ? `tel:${student.phone}` : undefined}
        />

        <StudentDateField
          label="Date of Birth"
          value={formData.dateOfBirth}
          isEditing={isEditing}
          onChange={(value) => updateField('dateOfBirth', value)}
          disabled={isPending}
        />
      </div>
    </div>
  )
}
