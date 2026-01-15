'use client'

import { useState } from 'react'

import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

import { StudentDetailsContent } from './student-details-content'
import { MahadBatch, MahadStudent } from '../../_types'

interface StudentDetailSheetProps {
  student: MahadStudent | null
  batches: MahadBatch[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function StudentDetailSheet({
  student,
  batches,
  open,
  onOpenChange,
}: StudentDetailSheetProps) {
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!student) return null

  function handleOpenChange(newOpen: boolean): void {
    if (!newOpen && isSubmitting) return
    if (!newOpen) setMode('view')
    onOpenChange(newOpen)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="flex w-full flex-col p-0 sm:max-w-lg">
        <SheetHeader className="border-b px-4 py-3 sm:px-6 sm:py-4">
          <SheetTitle>{student.name}</SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 px-4 py-4 sm:px-6">
          <StudentDetailsContent
            student={student}
            batches={batches}
            mode={mode}
            onModeChange={setMode}
            onSubmitStateChange={setIsSubmitting}
            showModeToggle
          />
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
