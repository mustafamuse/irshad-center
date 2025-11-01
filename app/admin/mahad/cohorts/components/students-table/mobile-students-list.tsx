'use client'

import { useState } from 'react'

import { BatchStudentData, BatchWithCount } from '@/lib/types/batch'

import { StudentDetailsSheet } from './student-details-sheet'
import { useLegacyActions, useSelectedStudents } from '../../store/ui-store'
import { StudentCard } from '../ui/student-card'

interface MobileStudentsListProps {
  students: BatchStudentData[]
  batches: BatchWithCount[]
}

export function MobileStudentsList({
  students,
  batches,
}: MobileStudentsListProps) {
  const { selectStudent, deselectStudent } = useLegacyActions()
  const selectedStudentIds = useSelectedStudents()
  const isStudentSelected = (id: string) => selectedStudentIds.has(id)

  // Sheet state
  const [selectedStudent, setSelectedStudent] =
    useState<BatchStudentData | null>(null)
  const [detailsSheetOpen, setDetailsSheetOpen] = useState(false)
  const [detailsSheetMode, setDetailsSheetMode] = useState<'view' | 'edit'>(
    'view'
  )

  const handleToggleStudent = (studentId: string) => {
    if (isStudentSelected(studentId)) {
      deselectStudent(studentId)
    } else {
      selectStudent(studentId)
    }
  }

  const handleViewDetails = (student: BatchStudentData) => {
    setSelectedStudent(student)
    setDetailsSheetMode('view')
    setDetailsSheetOpen(true)
  }

  if (students.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        No students found matching your filters.
      </div>
    )
  }

  return (
    <>
      <div className="grid gap-3">
        {students.map((student) => (
          <StudentCard
            key={student.id}
            student={student}
            isSelected={isStudentSelected(student.id)}
            onToggle={() => handleToggleStudent(student.id)}
            onViewDetails={() => handleViewDetails(student)}
            selectable={true}
            compact={false}
          />
        ))}
      </div>

      {selectedStudent && (
        <StudentDetailsSheet
          student={selectedStudent}
          batches={batches}
          open={detailsSheetOpen}
          mode={detailsSheetMode}
          onOpenChange={setDetailsSheetOpen}
          onModeChange={setDetailsSheetMode}
        />
      )}
    </>
  )
}
