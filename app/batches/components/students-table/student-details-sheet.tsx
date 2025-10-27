'use client'

import { useTransition } from 'react'

import { Edit, Eye, Save, X } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { BatchStudentData, BatchWithCount } from '@/lib/types/batch'

import { updateStudentAction } from '../../actions'
import { BasicInfoSection } from './sections/BasicInfoSection'
import { BatchSection } from './sections/BatchSection'
import { EducationSection } from './sections/EducationSection'
import { SiblingsSection } from './sections/SiblingsSection'
import { useStudentForm } from '../../hooks/use-student-form'

interface StudentDetailsSheetProps {
  student: BatchStudentData
  batches: BatchWithCount[]
  open: boolean
  mode: 'view' | 'edit'
  onOpenChange: (open: boolean) => void
  onModeChange?: (mode: 'view' | 'edit') => void
}

export function StudentDetailsSheet({
  student,
  batches,
  open,
  mode,
  onOpenChange,
  onModeChange,
}: StudentDetailsSheetProps) {
  const [isPending, startTransition] = useTransition()
  const { formData, updateField, toPayload, isValid, reset } = useStudentForm(
    student,
    open
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-2xl"
      >
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <Edit className="h-5 w-5" />
                  Edit Student
                </>
              ) : (
                <>
                  <Eye className="h-5 w-5" />
                  Student Details
                </>
              )}
            </SheetTitle>
            {!isEditing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onModeChange?.('edit')}
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
          </div>
          <SheetDescription>
            {isEditing
              ? 'Update student information. Required fields are marked with *'
              : 'View and manage student information'}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6 pb-6">
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

          {isEditing && (
            <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row-reverse">
              <Button onClick={handleSave} disabled={isPending || !isValid}>
                <Save className="mr-2 h-4 w-4" />
                {isPending ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isPending}
              >
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
