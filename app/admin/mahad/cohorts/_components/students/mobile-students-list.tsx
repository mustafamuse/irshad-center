'use client'

import { useRouter } from 'next/navigation'

import { BatchStudentData, BatchWithCount } from '@/lib/types/batch'

import { useLegacyActions, useSelectedStudents } from '../../_store/ui-store'
import { StudentCard } from '../shared/ui/student-card'

interface MobileStudentsListProps {
  students: BatchStudentData[]
  batches: BatchWithCount[]
}

export function MobileStudentsList({ students }: MobileStudentsListProps) {
  const router = useRouter()
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

  const handleViewDetails = (studentId: string) => {
    router.push(`/admin/mahad/cohorts/students/${studentId}`)
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
          onViewDetails={() => handleViewDetails(student.id)}
          selectable={true}
          compact={false}
        />
      ))}
    </div>
  )
}
