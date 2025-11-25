'use client'

import { BatchStudentData } from '@/lib/types/batch'

interface UseStudentSelectionProps {
  selectedStudents: BatchStudentData[]
  updateSelectedStudents: (students: BatchStudentData[]) => void
}

export function useStudentSelection({
  selectedStudents,
  updateSelectedStudents,
}: UseStudentSelectionProps) {
  const handleStudentSelect = (student: BatchStudentData) => {
    if (!selectedStudents.find((s) => s.id === student.id)) {
      const newStudents = [...selectedStudents, student]
      updateSelectedStudents(newStudents)
    }
  }

  const handleStudentRemove = (studentId: string) => {
    const newStudents = selectedStudents.filter((s) => s.id !== studentId)
    updateSelectedStudents(newStudents)
  }

  const isStudentSelected = (studentId: string) =>
    selectedStudents.some((s) => s.id === studentId)

  return {
    handleStudentSelect,
    handleStudentRemove,
    isStudentSelected,
  }
}
