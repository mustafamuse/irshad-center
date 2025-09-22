import { useCallback, useMemo } from 'react'

import { useAttendanceStore } from '../_store/attendance.store'
import type { AttendanceStatus } from '../_store/attendance.store'

export function useAttendance() {
  const store = useAttendanceStore()

  const {
    sessions,
    currentSession,
    selectedDate,
    selectedBatchId,
    students,
    isMarkingAttendance,
    expandedSessions,
    searchQuery,
    isLoadingSessions,
    isLoadingStudents,
    isSubmitting,
    sessionsError,
    studentsError,
    submitError,
  } = store

  // Filtered students based on search query
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students

    const query = searchQuery.toLowerCase()
    return students.filter(
      (student) =>
        student.name.toLowerCase().includes(query) ||
        student.email.toLowerCase().includes(query) ||
        student.rollNumber?.toLowerCase().includes(query)
    )
  }, [students, searchQuery])

  // Helper to format attendance data for submission
  const prepareAttendanceData = useCallback(
    (records: Array<{ studentId: string; status: AttendanceStatus }>) => {
      if (!selectedDate || !selectedBatchId) {
        throw new Error('Date and batch must be selected')
      }

      return {
        date: selectedDate,
        batchId: selectedBatchId,
        records,
      }
    },
    [selectedDate, selectedBatchId]
  )

  // Computed session summary
  const sessionStats = useMemo(() => {
    return {
      total: sessions.length,
      perfect: sessions.filter(
        (session) => session.summary.present === session.summary.total
      ).length,
      averageAttendance:
        sessions.length > 0
          ? Math.round(
              sessions.reduce(
                (acc, session) =>
                  acc + (session.summary.present / session.summary.total) * 100,
                0
              ) / sessions.length || 0
            )
          : 0,
    }
  }, [sessions])

  // Error handling helper
  const hasErrors = useMemo(
    () => Boolean(sessionsError || studentsError || submitError),
    [sessionsError, studentsError, submitError]
  )

  // Loading state helper
  const isLoading = useMemo(
    () => isLoadingSessions || isLoadingStudents || isSubmitting,
    [isLoadingSessions, isLoadingStudents, isSubmitting]
  )

  return {
    // Data
    sessions,
    currentSession,
    selectedDate,
    selectedBatchId,
    students: filteredStudents,
    sessionStats,

    // UI State
    isMarkingAttendance,
    expandedSessions,
    searchQuery,

    // Loading & Error States
    isLoading,
    hasErrors,
    errors: {
      sessions: sessionsError,
      students: studentsError,
      submit: submitError,
    },

    // Actions
    ...store,
    prepareAttendanceData,
  }
}
