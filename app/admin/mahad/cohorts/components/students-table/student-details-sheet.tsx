'use client'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { BatchStudentData, BatchWithCount } from '@/lib/types/batch'

import { StudentDetailsContent } from './student-details-content'

interface StudentDetailsSheetProps {
  student: BatchStudentData
  batches: BatchWithCount[]
  open: boolean
  mode: 'view' | 'edit'
  onOpenChange: (open: boolean) => void
  onModeChange?: (mode: 'view' | 'edit') => void
}

/**
 * Student Details Sheet (Side Panel)
 *
 * DEPRECATED: This component is being phased out in favor of intercepting routes.
 * Use Link to /students/[id] instead, which will show a modal on list pages
 * and a full page on direct navigation.
 *
 * Kept for backward compatibility during migration.
 */
export function StudentDetailsSheet({
  student,
  batches,
  open,
  mode,
  onOpenChange,
  onModeChange,
}: StudentDetailsSheetProps) {
  const isEditing = mode === 'edit'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-2xl"
      >
        <SheetHeader>
          <SheetTitle>
            {isEditing ? 'Edit Student' : 'Student Details'}
          </SheetTitle>
          <SheetDescription>
            {isEditing
              ? 'Update student information. Required fields are marked with *'
              : 'View and manage student information'}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 pb-6">
          <StudentDetailsContent
            student={student}
            batches={batches}
            mode={mode}
            onModeChange={onModeChange}
            showModeToggle={false} // Sheet header already has the title
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
