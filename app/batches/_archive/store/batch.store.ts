/**
 * @deprecated This store is deprecated and will be removed in a future version.
 *
 * MIGRATION GUIDE:
 * - Use the new store at app/batches/store/ui-store.ts for UI state only
 * - Server data (batches, students) should be fetched in Server Components
 * - Use updated hooks that accept data as parameters:
 *   - useBatches(batches) from hooks/use-batches.ts
 *   - useStudents(students) from hooks/use-students.ts
 *   - useStudentFilters() from hooks/use-filters.ts
 *
 * The new architecture:
 * - Server Components fetch data using functions from data.ts
 * - Data is passed as props to Client Components
 * - UI state (filters, selections, dialogs) is managed by ui-store.ts
 * - Client-side filtering uses utilities from store/filter-utils.ts
 *
 * This file is kept temporarily for reference during migration.
 */

import { enableMapSet } from 'immer'
import { create } from 'zustand'
import { devtools, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

// Enable Immer MapSet plugin for using Set in the store
enableMapSet()
import {
  BatchWithCount,
  BatchStudentData,
  StudentFilters,
  StudentStatus,
  LoadingState,
  ErrorState,
} from '../_types'

// Helper function to recalculate filtered students
const recalculateFilteredStudents = (state: any) => {
  state.filteredStudents = state.students.filter((student: any) => {
    const { filters } = state

    // Search filter
    if (filters.search?.query) {
      const searchQuery = filters.search.query.toLowerCase()
      const matchesSearch =
        filters.search.fields?.some((field: string) => {
          const value = student[field]
          return value && value.toLowerCase().includes(searchQuery)
        }) ?? false
      if (!matchesSearch) return false
    }

    // Batch filter
    if ((filters.batch?.selected?.length ?? 0) > 0) {
      const studentBatchId = student.batch?.id
      const isInSelectedBatch =
        studentBatchId && filters.batch?.selected?.includes(studentBatchId)
      const isUnassignedAndIncluded =
        !studentBatchId && filters.batch?.includeUnassigned

      if (!isInSelectedBatch && !isUnassignedAndIncluded) return false
    }

    // Status filter
    if ((filters.status?.selected?.length ?? 0) > 0) {
      const studentStatus = student.status as StudentStatus
      if (!filters.status?.selected?.includes(studentStatus)) return false
    }

    // Education level filter
    if ((filters.educationLevel?.selected?.length ?? 0) > 0) {
      if (
        !student.educationLevel ||
        !filters.educationLevel?.selected?.includes(student.educationLevel)
      ) {
        return false
      }
    }

    // Grade level filter
    if ((filters.gradeLevel?.selected?.length ?? 0) > 0) {
      if (
        !student.gradeLevel ||
        !filters.gradeLevel?.selected?.includes(student.gradeLevel)
      ) {
        return false
      }
    }

    // Date range filter
    if (filters.dateRange?.from || filters.dateRange?.to) {
      const field = filters.dateRange?.field ?? 'createdAt'
      const studentDate = new Date(student[field] as string)

      if (filters.dateRange?.from && studentDate < filters.dateRange.from)
        return false
      if (filters.dateRange?.to && studentDate > filters.dateRange.to)
        return false
    }

    return true
  })
}

// Default filter state
const defaultFilters: StudentFilters = {
  search: {
    query: '',
    fields: ['name', 'email', 'phone'],
  },
  batch: {
    selected: [],
    includeUnassigned: true,
  },
  status: {
    selected: [],
  },
  educationLevel: {
    selected: [],
  },
  gradeLevel: {
    selected: [],
  },
  dateRange: {
    from: null,
    to: null,
    field: 'createdAt',
  },
}

// Store interface
interface BatchStore {
  // State
  batches: BatchWithCount[]
  students: BatchStudentData[]
  selectedBatch: BatchWithCount | null
  selectedStudents: Set<string>
  filters: StudentFilters

  // Loading states
  batchesLoading: LoadingState
  studentsLoading: LoadingState

  // Error states
  batchesError: ErrorState
  studentsError: ErrorState

  // UI State
  isAssignDialogOpen: boolean
  isCreateBatchDialogOpen: boolean
  duplicatesExpanded: boolean

  // Computed State
  filteredStudents: BatchStudentData[]
  selectedStudentsData: BatchStudentData[]

  // Actions - Batch Management
  setBatches: (batches: BatchWithCount[]) => void
  setBatchesLoading: (loading: boolean, text?: string) => void
  setBatchesError: (error: Error | string | null) => void
  addBatch: (batch: BatchWithCount) => void
  updateBatch: (id: string, updates: Partial<BatchWithCount>) => void
  removeBatch: (id: string) => void
  selectBatch: (batch: BatchWithCount | null) => void

  // Actions - Student Management
  setStudents: (students: BatchStudentData[]) => void
  setStudentsLoading: (loading: boolean, text?: string) => void
  setStudentsError: (error: Error | string | null) => void
  updateStudent: (id: string, updates: Partial<BatchStudentData>) => void
  removeStudent: (id: string) => void

  // Actions - Selection Management
  selectStudent: (studentId: string) => void
  deselectStudent: (studentId: string) => void
  selectAllStudents: () => void
  clearSelection: () => void
  isStudentSelected: (studentId: string) => boolean
  getSelectedStudentsData: () => BatchStudentData[]

  // Actions - Filter Management
  setFilter: <K extends keyof StudentFilters>(
    key: K,
    value: StudentFilters[K]
  ) => void
  updateSearchQuery: (query: string) => void
  addBatchFilter: (batchId: string) => void
  removeBatchFilter: (batchId: string) => void
  addStatusFilter: (status: StudentStatus) => void
  removeStatusFilter: (status: StudentStatus) => void
  resetFilters: () => void
  hasActiveFilters: () => boolean

  // Actions - UI State
  setAssignDialogOpen: (open: boolean) => void
  setCreateBatchDialogOpen: (open: boolean) => void
  setDuplicatesExpanded: (expanded: boolean) => void

  // Actions - Computed
  updateFilteredStudents: () => void
  updateSelectedStudentsData: () => void
  getBatchStudentCount: (batchId: string) => number
  getUnassignedStudentsCount: () => number
  getTotalStudentsCount: () => number

  // Actions - Cleanup
  reset: () => void
}

export const useBatchStore = create<BatchStore>()(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        // Initial state
        batches: [],
        students: [],
        selectedBatch: null,
        selectedStudents: new Set(),
        filters: defaultFilters,

        batchesLoading: { isLoading: false },
        studentsLoading: { isLoading: false },

        batchesError: { hasError: false },
        studentsError: { hasError: false },

        isAssignDialogOpen: false,
        isCreateBatchDialogOpen: false,
        duplicatesExpanded: false,

        // Computed state
        filteredStudents: [],
        selectedStudentsData: [],

        // Batch Management Actions
        setBatches: (batches) =>
          set((state) => {
            state.batches = batches
          }),

        setBatchesLoading: (loading, text) =>
          set((state) => {
            state.batchesLoading = { isLoading: loading, loadingText: text }
          }),

        setBatchesError: (error) =>
          set((state) => {
            state.batchesError = {
              hasError: !!error,
              error: error || undefined,
            }
          }),

        addBatch: (batch) =>
          set((state) => {
            state.batches.unshift(batch)
          }),

        updateBatch: (id, updates) =>
          set((state) => {
            const index = state.batches.findIndex(
              (b: BatchWithCount) => b.id === id
            )
            if (index !== -1) {
              Object.assign(state.batches[index], updates)
            }
          }),

        removeBatch: (id) =>
          set((state) => {
            state.batches = state.batches.filter(
              (b: BatchWithCount) => b.id !== id
            )
            if (state.selectedBatch?.id === id) {
              state.selectedBatch = null
            }
          }),

        selectBatch: (batch) =>
          set((state) => {
            state.selectedBatch = batch
          }),

        // Student Management Actions
        setStudents: (students) =>
          set((state) => {
            state.students = students
            recalculateFilteredStudents(state)
            state.selectedStudentsData = students.filter((student) =>
              state.selectedStudents.has(student.id)
            )
          }),

        setStudentsLoading: (loading, text) =>
          set((state) => {
            state.studentsLoading = { isLoading: loading, loadingText: text }
          }),

        setStudentsError: (error) =>
          set((state) => {
            state.studentsError = {
              hasError: !!error,
              error: error || undefined,
            }
          }),

        updateStudent: (id, updates) =>
          set((state) => {
            const index = state.students.findIndex(
              (s: BatchStudentData) => s.id === id
            )
            if (index !== -1) {
              Object.assign(state.students[index], updates)
            }
          }),

        removeStudent: (id) =>
          set((state) => {
            state.students = state.students.filter(
              (s: BatchStudentData) => s.id !== id
            )
            state.selectedStudents.delete(id)
          }),

        // Selection Management Actions
        selectStudent: (studentId) =>
          set((state) => {
            state.selectedStudents.add(studentId)
          }),

        deselectStudent: (studentId) =>
          set((state) => {
            state.selectedStudents.delete(studentId)
          }),

        selectAllStudents: () =>
          set((state) => {
            state.selectedStudents = new Set(
              state.filteredStudents.map((s) => s.id)
            )
          }),

        clearSelection: () =>
          set((state) => {
            state.selectedStudents = new Set()
          }),

        isStudentSelected: (studentId) => {
          return get().selectedStudents.has(studentId)
        },

        getSelectedStudentsData: () => {
          const { students, selectedStudents } = get()
          return students.filter((s) => selectedStudents.has(s.id))
        },

        // Filter Management Actions
        setFilter: (key, value) =>
          set((state) => {
            state.filters[key] = value as any
          }),

        updateSearchQuery: (query) =>
          set((state) => {
            if (!state.filters.search) {
              state.filters.search = {
                query: '',
                fields: ['name', 'email', 'phone'],
              }
            }
            state.filters.search.query = query
            recalculateFilteredStudents(state)
          }),

        addBatchFilter: (batchId) =>
          set((state) => {
            if (!state.filters.batch) {
              state.filters.batch = { selected: [], includeUnassigned: true }
            }
            if (!state.filters.batch.selected!.includes(batchId)) {
              state.filters.batch.selected!.push(batchId)
            }
          }),

        removeBatchFilter: (batchId) =>
          set((state) => {
            if (!state.filters.batch) {
              state.filters.batch = { selected: [], includeUnassigned: true }
            }
            state.filters.batch.selected = state.filters.batch.selected!.filter(
              (id: string) => id !== batchId
            )
          }),

        addStatusFilter: (status) =>
          set((state) => {
            if (!state.filters.status) {
              state.filters.status = { selected: [] }
            }
            if (!state.filters.status.selected!.includes(status)) {
              state.filters.status.selected!.push(status)
            }
          }),

        removeStatusFilter: (status) =>
          set((state) => {
            if (!state.filters.status) {
              state.filters.status = { selected: [] }
            }
            state.filters.status.selected =
              state.filters.status.selected!.filter((s: string) => s !== status)
          }),

        resetFilters: () =>
          set((state) => {
            state.filters = { ...defaultFilters }
            state.selectedStudents = new Set()
          }),

        hasActiveFilters: () => {
          const { filters } = get()
          return (
            (filters.search?.query?.length ?? 0) > 0 ||
            (filters.batch?.selected?.length ?? 0) > 0 ||
            (filters.status?.selected?.length ?? 0) > 0 ||
            (filters.educationLevel?.selected?.length ?? 0) > 0 ||
            (filters.gradeLevel?.selected?.length ?? 0) > 0 ||
            filters.dateRange?.from !== null ||
            filters.dateRange?.to !== null
          )
        },

        // UI State Actions
        setAssignDialogOpen: (open) =>
          set((state) => {
            state.isAssignDialogOpen = open
          }),

        setCreateBatchDialogOpen: (open) =>
          set((state) => {
            state.isCreateBatchDialogOpen = open
          }),

        setDuplicatesExpanded: (expanded) =>
          set((state) => {
            state.duplicatesExpanded = expanded
          }),

        // Computed Actions
        updateFilteredStudents: () =>
          set((state) => {
            const { students, filters } = state

            state.filteredStudents = students.filter((student) => {
              // Search filter
              if (filters.search?.query) {
                const query = filters.search.query.toLowerCase()
                const matchesSearch =
                  filters.search.fields?.some((field) => {
                    const value = student[field]
                    return value && value.toLowerCase().includes(query)
                  }) ?? false
                if (!matchesSearch) return false
              }

              // Batch filter
              if ((filters.batch?.selected?.length ?? 0) > 0) {
                const studentBatchId = student.batch?.id
                const isInSelectedBatch =
                  studentBatchId &&
                  filters.batch?.selected?.includes(studentBatchId)
                const isUnassignedAndIncluded =
                  !studentBatchId && filters.batch?.includeUnassigned

                if (!isInSelectedBatch && !isUnassignedAndIncluded) return false
              }

              // Status filter
              if ((filters.status?.selected?.length ?? 0) > 0) {
                if (
                  !filters.status?.selected?.includes(
                    student.status as StudentStatus
                  )
                )
                  return false
              }

              // Education level filter
              if ((filters.educationLevel?.selected?.length ?? 0) > 0) {
                if (
                  !student.educationLevel ||
                  !filters.educationLevel?.selected?.includes(
                    student.educationLevel
                  )
                ) {
                  return false
                }
              }

              // Grade level filter
              if ((filters.gradeLevel?.selected?.length ?? 0) > 0) {
                if (
                  !student.gradeLevel ||
                  !filters.gradeLevel?.selected?.includes(student.gradeLevel)
                ) {
                  return false
                }
              }

              // Date range filter
              if (filters.dateRange?.from || filters.dateRange?.to) {
                const field = filters.dateRange?.field ?? 'createdAt'
                const studentDate = new Date(
                  student[field as keyof BatchStudentData] as string
                )

                if (
                  filters.dateRange?.from &&
                  studentDate < filters.dateRange.from
                )
                  return false
                if (filters.dateRange?.to && studentDate > filters.dateRange.to)
                  return false
              }

              return true
            })
          }),

        updateSelectedStudentsData: () =>
          set((state) => {
            state.selectedStudentsData = state.students.filter((student) =>
              state.selectedStudents.has(student.id)
            )
          }),

        getBatchStudentCount: (batchId) => {
          const { students } = get()
          return students.filter((s) => s.batch?.id === batchId).length
        },

        getUnassignedStudentsCount: () => {
          const { students } = get()
          return students.filter((s) => !s.batch).length
        },

        getTotalStudentsCount: () => {
          return get().students.length
        },

        // Cleanup
        reset: () =>
          set((state) => {
            state.batches = []
            state.students = []
            state.selectedBatch = null
            state.selectedStudents = new Set()
            state.filters = { ...defaultFilters }
            state.batchesLoading = { isLoading: false }
            state.studentsLoading = { isLoading: false }
            state.batchesError = { hasError: false }
            state.studentsError = { hasError: false }
            state.isAssignDialogOpen = false
            state.isCreateBatchDialogOpen = false
            state.duplicatesExpanded = false
          }),
      }))
    ),
    {
      name: 'batch-store',
    }
  )
)

// Selectors for optimal re-rendering
export const useBatches = () => useBatchStore((state) => state.batches)
export const useStudents = () => useBatchStore((state) => state.students)
export const useFilteredStudents = () =>
  useBatchStore((state) => state.filteredStudents)
export const useSelectedStudents = () =>
  useBatchStore((state) => state.selectedStudentsData)
export const useFilters = () => useBatchStore((state) => state.filters)
export const useBatchesLoading = () =>
  useBatchStore((state) => state.batchesLoading)
export const useStudentsLoading = () =>
  useBatchStore((state) => state.studentsLoading)
