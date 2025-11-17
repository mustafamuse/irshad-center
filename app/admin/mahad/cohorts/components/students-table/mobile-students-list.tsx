'use client'

import Link from 'next/link'

import { BatchStudentData, BatchWithCount } from '@/lib/types/batch'

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
        <Link
          key={student.id}
          href={`/admin/mahad/cohorts/students/${student.id}`}
          className="block"
        >
          <StudentCard
            student={student}
            isSelected={isStudentSelected(student.id)}
            onToggle={() => handleToggleStudent(student.id)}
            selectable={true}
            compact={false}
          />
        </Link>
      ))}
    </div>
  )
}
