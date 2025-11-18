'use client'

import { useState } from 'react'

import { useRouter } from 'next/navigation'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { StudentDetailData, BatchWithCount } from '@/lib/types/batch'

import { StudentDetailsContent } from '../../../_components/students/student-details-content'

type Props = {
  student: StudentDetailData
  batches: BatchWithCount[]
  initialMode?: 'view' | 'edit'
}

/**
 * Student Detail Modal Component
 *
 * Renders student details in a modal dialog.
 * Uses Next.js router to navigate back when closed.
 */
export function StudentDetailModal({
  student,
  batches,
  initialMode = 'view',
}: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<'view' | 'edit'>(initialMode)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      // Navigate back to the list page
      router.back()
    }
  }

  const isEditing = mode === 'edit'
  const titleId = 'student-detail-title'
  const descriptionId = 'student-detail-description'

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-h-[90vh] max-w-3xl p-0"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={isSubmitting}
        onOpenAutoFocus={(e) => {
          // Focus the first input in edit mode, or the close button in view mode
          if (isEditing && e.currentTarget) {
            const target = e.currentTarget as HTMLElement
            const firstInput = target.querySelector<HTMLInputElement>(
              'input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
            )
            if (firstInput) {
              e.preventDefault()
              firstInput.focus()
            }
          }
        }}
      >
        <DialogHeader className="px-6 pt-6">
          <DialogTitle id={titleId}>{student.name}</DialogTitle>
          <DialogDescription id={descriptionId}>
            {isEditing
              ? 'Update student information. Required fields are marked with an asterisk (*)'
              : 'View and manage student information'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-100px)] px-6 pb-6">
          <div role="region" aria-label="Student details form">
            <StudentDetailsContent
              student={student}
              batches={batches}
              mode={mode}
              onModeChange={(newMode) => {
                setMode(newMode)
                // Update submitting state when mode changes
                if (newMode === 'view') {
                  setIsSubmitting(false)
                }
              }}
              onSubmitStateChange={setIsSubmitting}
              showModeToggle={true}
            />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
