'use client'

import { BatchStudentData } from '@/lib/types/batch'

import { useLegacyActions, useSelectedStudents } from '../../store/ui-store'
import { StudentCard } from '../ui/student-card'

interface MobileStudentsListProps {
  students: BatchStudentData[]
}

export function MobileStudentsList({ students }: MobileStudentsListProps) {
  const { selectStudent, deselectStudent } = useLegacyActions()
  const selectedStudentIds = useSelectedStudents()
  const isStudentSelected = (id: string) => selectedStudentIds.has(id)

  const handleToggleStudent = (studentId: string) => {
    if (isStudentSelected(studentId)) {
      deselectStudent(studentId)
    } else {
      selectStudent(studentId)
    }
  }

  if (students.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        No students found matching your filters.
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      {students.map((student) => (
        <StudentCard
          key={student.id}
          student={student}
          isSelected={isStudentSelected(student.id)}
          onToggle={() => handleToggleStudent(student.id)}
          selectable={true}
          compact={false}
        />
      ))}
    </div>
  )
}
