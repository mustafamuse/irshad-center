'use client'

import { useState, useTransition, useEffect } from 'react'

import { useRouter } from 'next/navigation'

import { Edit, Eye, Link2, Save, X } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  BatchStudentData,
  StudentDetailData,
  BatchWithCount,
} from '@/lib/types/batch'

import { updateStudentAction } from '../../../cohorts/_actions'
import { useStudentForm } from '../../_hooks/use-student-form'
import { PaymentLinkDialog } from '../dialogs/payment-link-dialog'
import { BasicInfoSection } from './sections/BasicInfoSection'
import { BatchSection } from './sections/BatchSection'
import { EducationSection } from './sections/EducationSection'
import { SiblingsSection } from './sections/SiblingsSection'

interface StudentDetailsContentProps {
  /** Student data to display/edit */
  student: BatchStudentData | StudentDetailData
  /** Available batches for cohort assignment */
  batches: BatchWithCount[]
  /** Current mode - 'view' for read-only, 'edit' for editable */
  mode?: 'view' | 'edit'
  /** Callback when mode changes */
  onModeChange?: (mode: 'view' | 'edit') => void
  /** Callback when form submission state changes */
  onSubmitStateChange?: (isSubmitting: boolean) => void
  /** Whether to show the mode toggle buttons */
  showModeToggle?: boolean
}

/**
 * StudentDetailsContent - Main form for viewing and editing student information
 *
 * Provides a comprehensive interface for student data management including:
 * - Basic info (name, email, phone, DOB)
 * - Cohort assignment
 * - Billing configuration
 * - Sibling relationships
 *
 * Supports both view and edit modes with proper form validation.
 */
export function StudentDetailsContent({
  student,
  batches,
  mode = 'view',
  onModeChange,
  onSubmitStateChange,
  showModeToggle = true,
}: StudentDetailsContentProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showPaymentLinkDialog, setShowPaymentLinkDialog] = useState(false)
  const { formData, updateField, toPayload, isValid, reset } = useStudentForm(
    student,
    true
  )

  useEffect(() => {
    onSubmitStateChange?.(isPending)
  }, [isPending, onSubmitStateChange])

  const handleSave = () => {
    if (!isValid) {
      toast.error('Please fill in all required fields')
      return
    }

    startTransition(async () => {
      const result = await updateStudentAction(student.id, toPayload())

      if (result.success) {
        toast.success('Student updated successfully')
        router.refresh()
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
          {!isEditing && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPaymentLinkDialog(true)}
              >
                <Link2 className="mr-2 h-4 w-4" />
                Payment Link
              </Button>
              {onModeChange && (
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
        </div>
      )}

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
        currentBatchName={student.batch?.name || null}
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
          <Button variant="outline" onClick={handleCancel} disabled={isPending}>
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
        </div>
      )}

      <PaymentLinkDialog
        profileId={student.id}
        studentName={student.name}
        open={showPaymentLinkDialog}
        onOpenChange={setShowPaymentLinkDialog}
      />
    </div>
  )
}
