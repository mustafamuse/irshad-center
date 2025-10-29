/**
 * UI-Only State Store for Batches
 *
 * Simplified store managing only UI state (filters, selections, dialog states).
 * Server data (batches, students) should be fetched in Server Components
 * and passed down as props to Client Components.
 */

import { EducationLevel, GradeLevel } from '@prisma/client'
import { enableMapSet } from 'immer'
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

import { BatchStudentData } from '@/lib/types/batch'
import { StudentStatus } from '@/lib/types/student'

// Enable Immer MapSet plugin for using Set in the store
enableMapSet()

// ============================================================================
// TYPES
// ============================================================================

export interface StudentFilters {
  search?: {
    query: string
    fields: ('name' | 'email' | 'phone')[]
  }
  batch?: {
    selected: string[]
    includeUnassigned: boolean
  }
  status?: {
    selected: StudentStatus[]
  }
  educationLevel?: {
    selected: EducationLevel[]
  }
  gradeLevel?: {
    selected: GradeLevel[]
  }
  dateRange?: {
    from: Date | null
    to: Date | null
    field: 'createdAt' | 'updatedAt' | 'dateOfBirth'
  }
}

interface UIStore {
  // ============================================================================
  // STATE
  // ============================================================================
  selectedStudentIds: Set<string>
  selectedBatchId: string | null
  filters: StudentFilters
  isCreateBatchDialogOpen: boolean
  isAssignStudentsDialogOpen: boolean
  duplicatesExpanded: boolean

  // ============================================================================
  // CORE ACTIONS (Simplified from 30+ to 10)
  // ============================================================================

  // Selection actions
  toggleStudentSelection: (id: string) => void
  setStudentSelection: (ids: string[]) => void
  clearStudentSelection: () => void
  selectBatch: (id: string | null) => void

  // Filter actions (unified)
  updateFilters: (updates: Partial<StudentFilters>) => void
  toggleFilter: (
    filterType: 'batch' | 'status' | 'educationLevel' | 'gradeLevel',
    value: string
  ) => void
  setSearchQuery: (query: string) => void
  resetFilters: () => void

  // Dialog actions
  setDialogOpen: (
    dialog: 'createBatch' | 'assignStudents' | 'duplicates',
    open: boolean
  ) => void

  // Utility actions
  reset: () => void
}

// ============================================================================
// DEFAULT STATE
// ============================================================================

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
    selected: [
      StudentStatus.REGISTERED,
      StudentStatus.ENROLLED,
      StudentStatus.ON_LEAVE,
    ],
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

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useUIStore = create<UIStore>()(
  devtools(
    immer((set) => ({
      // Initial state
      selectedStudentIds: new Set(),
      selectedBatchId: null,
      filters: defaultFilters,
      isCreateBatchDialogOpen: false,
      isAssignStudentsDialogOpen: false,
      duplicatesExpanded: false,

      // ========================================================================
      // SELECTION ACTIONS
      // ========================================================================

      toggleStudentSelection: (id) =>
        set((state) => {
          if (state.selectedStudentIds.has(id)) {
            state.selectedStudentIds.delete(id)
          } else {
            state.selectedStudentIds.add(id)
          }
        }),

      setStudentSelection: (ids) =>
        set((state) => {
          state.selectedStudentIds = new Set(ids)
        }),

      clearStudentSelection: () =>
        set((state) => {
          state.selectedStudentIds = new Set()
        }),

      selectBatch: (id) =>
        set((state) => {
          state.selectedBatchId = id
        }),

      // ========================================================================
      // FILTER ACTIONS (Unified & Simplified)
      // ========================================================================

      updateFilters: (updates) =>
        set((state) => {
          state.filters = { ...state.filters, ...updates }
        }),

      toggleFilter: (filterType, value) =>
        set((state) => {
          const filter = state.filters[filterType]
          if (!filter || !('selected' in filter)) return

          const index = filter.selected.indexOf(value as never)
          if (index > -1) {
            filter.selected.splice(index, 1)
          } else {
            filter.selected.push(value as never)
          }
        }),

      setSearchQuery: (query) =>
        set((state) => {
          if (!state.filters.search) {
            state.filters.search = {
              query: '',
              fields: ['name', 'email', 'phone'],
            }
          }
          state.filters.search.query = query
        }),

      resetFilters: () =>
        set((state) => {
          state.filters = { ...defaultFilters }
          state.selectedStudentIds = new Set()
        }),

      // ========================================================================
      // DIALOG ACTIONS (Unified)
      // ========================================================================

      setDialogOpen: (dialog, open) =>
        set((state) => {
          if (dialog === 'createBatch') {
            state.isCreateBatchDialogOpen = open
          } else if (dialog === 'assignStudents') {
            state.isAssignStudentsDialogOpen = open
          } else if (dialog === 'duplicates') {
            state.duplicatesExpanded = open
          }
        }),

      // ========================================================================
      // UTILITY ACTIONS
      // ========================================================================

      reset: () =>
        set((state) => {
          state.selectedStudentIds = new Set()
          state.selectedBatchId = null
          state.filters = { ...defaultFilters }
          state.isCreateBatchDialogOpen = false
          state.isAssignStudentsDialogOpen = false
          state.duplicatesExpanded = false
        }),
    })),
    {
      name: 'batch-ui-store',
    }
  )
)

// ============================================================================
// SELECTORS
// ============================================================================

export const useSelectedStudents = () =>
  useUIStore((state) => state.selectedStudentIds)
export const useSelectedBatch = () =>
  useUIStore((state) => state.selectedBatchId)
export const useFilters = () => useUIStore((state) => state.filters)

// Separate selectors for each dialog type (avoids conditional hooks)
export const useCreateBatchDialogState = () =>
  useUIStore((state) => state.isCreateBatchDialogOpen)
export const useAssignStudentsDialogState = () =>
  useUIStore((state) => state.isAssignStudentsDialogOpen)
export const useDuplicatesExpandedState = () =>
  useUIStore((state) => state.duplicatesExpanded)

// ============================================================================
// FILTER UTILITIES (Moved from filter-utils.ts)
// ============================================================================

/**
 * Filter students based on current filter state
 */
export function filterStudents(
  students: BatchStudentData[],
  filters: StudentFilters
): BatchStudentData[] {
  return students.filter((student) => {
    // Search filter
    if (filters.search?.query) {
      const searchQuery = filters.search.query.toLowerCase().trim()
      const matchesSearch =
        filters.search.fields?.some((field) => {
          const value = student[field]
          if (!value) return false

          // Special handling for phone field
          if (field === 'phone') {
            const phoneDigits = value.replace(/\D/g, '')
            const searchDigits = searchQuery.replace(/\D/g, '')

            // Support last 4 digits search OR full/partial number match
            return (
              phoneDigits.includes(searchDigits) ||
              (searchDigits.length === 4 && phoneDigits.endsWith(searchDigits))
            )
          }

          // Standard text search for name, email
          return value.toLowerCase().includes(searchQuery)
        }) ?? false
      if (!matchesSearch) return false
    }

    // Batch filter
    if ((filters.batch?.selected?.length ?? 0) > 0) {
      const studentBatchId = student.Batch?.id
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
      const fieldValue = student[field]
      const studentDate = new Date(
        fieldValue instanceof Date
          ? fieldValue
          : (fieldValue as string | number | null) || new Date()
      )

      if (filters.dateRange?.from && studentDate < filters.dateRange.from)
        return false
      if (filters.dateRange?.to && studentDate > filters.dateRange.to)
        return false
    }

    return true
  })
}

/**
 * Count active filters
 */
export function countActiveFilters(filters: StudentFilters): number {
  let count = 0

  if ((filters.search?.query?.length ?? 0) > 0) count++
  if ((filters.batch?.selected?.length ?? 0) > 0) count++
  if ((filters.status?.selected?.length ?? 0) > 0) count++
  if ((filters.educationLevel?.selected?.length ?? 0) > 0) count++
  if ((filters.gradeLevel?.selected?.length ?? 0) > 0) count++
  if (filters.dateRange?.from || filters.dateRange?.to) count++

  return count
}

/**
 * Get selected students data
 */
export function getSelectedStudentsData(
  students: BatchStudentData[],
  selectedIds: Set<string>
): BatchStudentData[] {
  return students.filter((s) => selectedIds.has(s.id))
}

// ============================================================================
// LEGACY ACTION COMPATIBILITY (For gradual migration)
// ============================================================================

/**
 * These provide backward compatibility with old action names.
 * Components can be migrated gradually to use the new simplified actions.
 */
export const useLegacyActions = () => {
  const store = useUIStore()
  return {
    // Old names -> New unified actions
    selectStudent: (id: string) => store.toggleStudentSelection(id),
    deselectStudent: (id: string) => store.toggleStudentSelection(id),
    toggleStudent: (id: string) => store.toggleStudentSelection(id),
    selectAllStudents: (ids: string[]) => store.setStudentSelection(ids),
    clearSelection: () => store.clearStudentSelection(),

    setSearchQuery: (query: string) => store.setSearchQuery(query),
    resetFilters: () => store.resetFilters(),

    setBatchFilter: (batchIds: string[]) =>
      store.updateFilters({
        batch: { selected: batchIds, includeUnassigned: true },
      }),
    toggleBatchFilter: (id: string) => store.toggleFilter('batch', id),
    setIncludeUnassigned: (include: boolean) =>
      store.updateFilters({
        batch: { ...store.filters.batch, includeUnassigned: include } as never,
      }),

    setStatusFilter: (statuses: StudentStatus[]) =>
      store.updateFilters({ status: { selected: statuses } }),
    toggleStatusFilter: (status: StudentStatus) =>
      store.toggleFilter('status', status),

    setEducationLevelFilter: (levels: EducationLevel[]) =>
      store.updateFilters({ educationLevel: { selected: levels } }),
    toggleEducationLevelFilter: (level: EducationLevel) =>
      store.toggleFilter('educationLevel', level),

    setGradeLevelFilter: (levels: GradeLevel[]) =>
      store.updateFilters({ gradeLevel: { selected: levels } }),
    toggleGradeLevelFilter: (level: GradeLevel) =>
      store.toggleFilter('gradeLevel', level),

    setCreateBatchDialogOpen: (open: boolean) =>
      store.setDialogOpen('createBatch', open),
    setAssignStudentsDialogOpen: (open: boolean) =>
      store.setDialogOpen('assignStudents', open),
    setDuplicatesExpanded: (open: boolean) =>
      store.setDialogOpen('duplicates', open),
  }
}
