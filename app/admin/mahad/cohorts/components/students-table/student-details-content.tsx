'use client'

import { useTransition } from 'react'

import { Edit, Eye, Save, X } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  BatchStudentData,
  StudentDetailData,
  BatchWithCount,
} from '@/lib/types/batch'

import { updateStudentAction } from '../../actions'
import { BasicInfoSection } from './sections/BasicInfoSection'
import { BatchSection } from './sections/BatchSection'
import { EducationSection } from './sections/EducationSection'
import { SiblingsSection } from './sections/SiblingsSection'
import { useStudentForm } from '../../hooks/use-student-form'

interface StudentDetailsContentProps {
  student: BatchStudentData | StudentDetailData
  batches: BatchWithCount[]
  mode?: 'view' | 'edit'
  onModeChange?: (mode: 'view' | 'edit') => void
  showModeToggle?: boolean
}

/**
 * Reusable Student Details Content
 *
 * This component contains the actual student detail sections and can be used in:
 * - Sheet/Modal (for quick view)
 * - Full page (for direct navigation)
 *
 * The parent component is responsible for the container (Sheet, Dialog, or Page).
 */
export function StudentDetailsContent({
  student,
  batches,
  mode = 'view',
  onModeChange,
  showModeToggle = true,
}: StudentDetailsContentProps) {
  const [isPending, startTransition] = useTransition()
  const { formData, updateField, toPayload, isValid, reset } = useStudentForm(
    student,
    true // Always initialize form
  )

  const handleSave = () => {
    if (!isValid) {
      toast.error('Please fill in all required fields')
      return
    }

    startTransition(async () => {
      const result = await updateStudentAction(
        student.id,
        toPayload() as Record<string, unknown>
      )

      if (result.success) {
        toast.success('Student updated successfully')
        onModeChange?.('view')
      } else {
        toast.error(result.error || 'Failed to update student')
      }
    })
  }

  const handleCancel = () => {
    reset()
    onModeChange?.('view')
  }

  const isEditing = mode === 'edit'

  return (
    <div className="space-y-6">
      {/* Header with mode toggle */}
      {showModeToggle && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Edit className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Edit Student</h2>
              </>
            ) : (
              <>
                <Eye className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Student Details</h2>
              </>
            )}
          </div>
          {!isEditing && onModeChange && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onModeChange('edit')}
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
        </div>
      )}

      {/* Sections */}
      <BasicInfoSection
        student={student}
        formData={formData}
        isEditing={isEditing}
        isPending={isPending}
        updateField={updateField}
      />

      <BatchSection
        formData={formData}
        isEditing={isEditing}
        isPending={isPending}
        updateField={updateField}
        batches={batches}
        currentBatchName={student.Batch?.name || null}
        studentStatus={student.status}
      />

      <EducationSection
        student={student}
        formData={formData}
        isEditing={isEditing}
        isPending={isPending}
        updateField={updateField}
      />

      <SiblingsSection student={student} />

      {/* Action buttons for edit mode */}
      {isEditing && (
        <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row-reverse">
          <Button onClick={handleSave} disabled={isPending || !isValid}>
            <Save className="mr-2 h-4 w-4" />
            {isPending ? 'Saving...' : 'Save Changes'}
          </Button>
          <Button variant="outline" onClick={handleCancel} disabled={isPending}>
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
        </div>
      )}
    </div>
  )
}
