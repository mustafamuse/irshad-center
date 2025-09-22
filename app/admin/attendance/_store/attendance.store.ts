import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'

export interface AttendanceRecord {
  id: string
  sessionId: string
  studentId: string
  status: AttendanceStatus
  notes?: string
  createdAt: Date
  updatedAt: Date
}

export interface AttendanceSession {
  id: string
  date: Date
  batchId: string
  notes?: string
  records: AttendanceRecord[]
  summary: {
    total: number
    present: number
    absent: number
    late: number
    excused: number
  }
}

export interface Student {
  id: string
  name: string
  email: string
  rollNumber?: string
}

interface AttendanceState {
  // Data
  sessions: AttendanceSession[]
  currentSession: AttendanceSession | null
  selectedDate: Date | null
  selectedBatchId: string | null
  students: Student[]

  // UI State
  isMarkingAttendance: boolean
  expandedSessions: Set<string>
  searchQuery: string

  // Loading States
  isLoadingSessions: boolean
  isLoadingStudents: boolean
  isSubmitting: boolean

  // Error States
  sessionsError: Error | null
  studentsError: Error | null
  submitError: Error | null

  // Actions
  setSelectedDate: (date: Date | null) => void
  setSelectedBatch: (batchId: string | null) => void
  setSearchQuery: (query: string) => void
  toggleSession: (sessionId: string) => void
  startMarkingAttendance: () => void
  stopMarkingAttendance: () => void

  // Data Actions
  fetchSessions: (filters?: {
    batchId?: string
    startDate?: Date
    endDate?: Date
  }) => Promise<void>
  fetchStudents: (batchId: string) => Promise<void>
  markAttendance: (data: {
    date: Date
    batchId: string
    records: Array<{
      studentId: string
      status: AttendanceStatus
    }>
  }) => Promise<void>
  clearErrors: () => void
}

export const useAttendanceStore = create<AttendanceState>()(
  devtools(
    (set, get) => ({
      // Initial State
      sessions: [],
      currentSession: null,
      selectedDate: null,
      selectedBatchId: null,
      students: [],
      isMarkingAttendance: false,
      expandedSessions: new Set(),
      searchQuery: '',
      isLoadingSessions: false,
      isLoadingStudents: false,
      isSubmitting: false,
      sessionsError: null,
      studentsError: null,
      submitError: null,

      // UI Actions
      setSelectedDate: (date) => set({ selectedDate: date }),
      setSelectedBatch: (batchId) => set({ selectedBatchId: batchId }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      toggleSession: (sessionId) =>
        set((state) => {
          const newExpanded = new Set(state.expandedSessions)
          if (newExpanded.has(sessionId)) {
            newExpanded.delete(sessionId)
          } else {
            newExpanded.add(sessionId)
          }
          return { expandedSessions: newExpanded }
        }),
      startMarkingAttendance: () => set({ isMarkingAttendance: true }),
      stopMarkingAttendance: () => set({ isMarkingAttendance: false }),

      // Data Actions
      fetchSessions: async (filters) => {
        set({ isLoadingSessions: true, sessionsError: null })
        try {
          const params = new URLSearchParams()
          if (filters?.batchId) params.append('batchId', filters.batchId)
          if (filters?.startDate)
            params.append('startDate', filters.startDate.toISOString())
          if (filters?.endDate)
            params.append('endDate', filters.endDate.toISOString())

          const response = await fetch(
            '/api/admin/attendance/history?' + params.toString()
          )
          const data = await response.json()

          if (!data.success)
            throw new Error(data.error || 'Failed to fetch sessions')

          set({ sessions: data.data })
        } catch (error) {
          set({ sessionsError: error as Error })
        } finally {
          set({ isLoadingSessions: false })
        }
      },

      fetchStudents: async (batchId) => {
        set({ isLoadingStudents: true, studentsError: null })
        try {
          const response = await fetch(`/api/batches/${batchId}/students`)
          const data = await response.json()

          if (!data.success)
            throw new Error(data.error || 'Failed to fetch students')

          set({ students: data.data })
        } catch (error) {
          set({ studentsError: error as Error })
        } finally {
          set({ isLoadingStudents: false })
        }
      },

      markAttendance: async (data) => {
        set({ isSubmitting: true, submitError: null })
        try {
          const response = await fetch('/api/admin/attendance/mark', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              date: data.date.toISOString(),
              batchId: data.batchId,
              attendance: data.records,
            }),
          })

          const result = await response.json()
          if (!result.success)
            throw new Error(result.error || 'Failed to mark attendance')

          // Refresh sessions after successful submission
          await get().fetchSessions({
            batchId: data.batchId,
            startDate: data.date,
            endDate: data.date,
          })

          set({ isMarkingAttendance: false })
        } catch (error) {
          set({ submitError: error as Error })
        } finally {
          set({ isSubmitting: false })
        }
      },

      clearErrors: () =>
        set({
          sessionsError: null,
          studentsError: null,
          submitError: null,
        }),
    }),
    { name: 'attendance-store' }
  )
)
