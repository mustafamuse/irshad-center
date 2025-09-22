import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAttendanceStore } from './attendance.store'
import { mockStudent, mockAttendanceSession } from '../_tests/test-utils'

describe('AttendanceStore', () => {
  beforeEach(() => {
    const store = useAttendanceStore.getState()
    store.reset()
  })

  describe('student management', () => {
    it('sets students', () => {
      const mockStudents = [mockStudent(), mockStudent()]

      act(() => {
        useAttendanceStore.getState().setStudents(mockStudents)
      })

      expect(useAttendanceStore.getState().students).toEqual(mockStudents)
    })

    it('filters students by search query', () => {
      const mockStudents = [
        mockStudent({ name: 'John Doe' }),
        mockStudent({ name: 'Jane Smith' }),
      ]

      act(() => {
        useAttendanceStore.getState().setStudents(mockStudents)
        useAttendanceStore.getState().setSearchQuery('john')
      })

      expect(useAttendanceStore.getState().filteredStudents).toHaveLength(1)
      expect(useAttendanceStore.getState().filteredStudents[0].name).toBe(
        'John Doe'
      )
    })

    it('handles student selection', () => {
      act(() => {
        useAttendanceStore.getState().setSelectedStudentIndex(2)
      })

      expect(useAttendanceStore.getState().selectedStudentIndex).toBe(2)
    })
  })

  describe('attendance management', () => {
    it('marks attendance for a student', () => {
      const studentId = 'student-1'

      act(() => {
        useAttendanceStore
          .getState()
          .handleAttendanceChange(studentId, 'present')
      })

      expect(useAttendanceStore.getState().attendance[studentId]).toBe(
        'present'
      )
    })

    it('clears attendance records', () => {
      act(() => {
        useAttendanceStore
          .getState()
          .handleAttendanceChange('student-1', 'present')
        useAttendanceStore
          .getState()
          .handleAttendanceChange('student-2', 'absent')
        useAttendanceStore.getState().clearAttendance()
      })

      expect(useAttendanceStore.getState().attendance).toEqual({})
    })

    it('marks all students with same status', () => {
      const mockStudents = [
        mockStudent({ id: 'student-1' }),
        mockStudent({ id: 'student-2' }),
      ]

      act(() => {
        useAttendanceStore.getState().setStudents(mockStudents)
        useAttendanceStore.getState().markAllStudents('present')
      })

      const attendance = useAttendanceStore.getState().attendance
      expect(attendance['student-1']).toBe('present')
      expect(attendance['student-2']).toBe('present')
    })
  })

  describe('session management', () => {
    it('sets attendance sessions', () => {
      const mockSessions = [mockAttendanceSession(), mockAttendanceSession()]

      act(() => {
        useAttendanceStore.getState().setSessions(mockSessions)
      })

      expect(useAttendanceStore.getState().sessions).toEqual(mockSessions)
    })

    it('handles session loading state', () => {
      act(() => {
        useAttendanceStore.getState().setSessionsLoading(true)
      })

      expect(useAttendanceStore.getState().sessionsLoading.isLoading).toBe(true)
    })

    it('handles session errors', () => {
      const error = new Error('Failed to load sessions')

      act(() => {
        useAttendanceStore.getState().setSessionsError(error)
      })

      expect(useAttendanceStore.getState().sessionsError.hasError).toBe(true)
      expect(useAttendanceStore.getState().sessionsError.error).toBe(error)
    })
  })

  describe('date management', () => {
    it('sets selected date', () => {
      const date = new Date('2025-01-01')

      act(() => {
        useAttendanceStore.getState().setSelectedDate(date)
      })

      expect(useAttendanceStore.getState().selectedDate).toEqual(date)
    })

    it('sets date range', () => {
      const range = {
        from: new Date('2025-01-01'),
        to: new Date('2025-01-31'),
      }

      act(() => {
        useAttendanceStore.getState().setDateRange(range)
      })

      expect(useAttendanceStore.getState().dateRange).toEqual(range)
    })
  })

  describe('error handling', () => {
    it('clears errors', () => {
      act(() => {
        useAttendanceStore.getState().setSessionsError(new Error('Test error'))
        useAttendanceStore.getState().clearErrors()
      })

      expect(useAttendanceStore.getState().sessionsError.hasError).toBe(false)
      expect(useAttendanceStore.getState().sessionsError.error).toBeNull()
    })
  })

  describe('store reset', () => {
    it('resets store to initial state', () => {
      act(() => {
        useAttendanceStore.getState().setStudents([mockStudent()])
        useAttendanceStore.getState().setSelectedStudentIndex(1)
        useAttendanceStore
          .getState()
          .handleAttendanceChange('student-1', 'present')
        useAttendanceStore.getState().reset()
      })

      const state = useAttendanceStore.getState()
      expect(state.students).toEqual([])
      expect(state.selectedStudentIndex).toBe(-1)
      expect(state.attendance).toEqual({})
    })
  })
})
