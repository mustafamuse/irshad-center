import { BookOpen, GraduationCap, School } from 'lucide-react'

import type { BatchStudentData, StudentDetailData } from '@/lib/types/batch'

import {
  formatEducationLevel,
  formatGradeLevel,
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

const EDUCATION_LEVEL_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'ELEMENTARY', label: 'Elementary' },
  { value: 'MIDDLE_SCHOOL', label: 'Middle School' },
  { value: 'HIGH_SCHOOL', label: 'High School' },
  { value: 'COLLEGE', label: 'College' },
  { value: 'POST_GRAD', label: 'Post Graduate' },
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
        <GraduationCap className="h-4 w-4" />
        Education Information
      </h3>

      <div className="space-y-3">
        <StudentSelectField
          id="educationLevel"
          label="Education Level"
          value={formData.educationLevel}
          options={EDUCATION_LEVEL_OPTIONS}
          isEditing={isEditing}
          onChange={(value) => updateField('educationLevel', value)}
          disabled={isPending}
          icon={BookOpen}
          displayValue={formatEducationLevel(student.educationLevel ?? null)}
          placeholder="Select education level"
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
      </div>
    </div>
  )
}
