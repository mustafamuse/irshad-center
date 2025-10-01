/**
 * UI-Only State Store for Batches
 *
 * This store manages ONLY UI state (filters, selections, dialog states).
 * Server data (batches, students) should be fetched in Server Components
 * and passed down as props to Client Components.
 *
 * Migration from old store (_store/batch.store.ts):
 * - Removed: batches, students, loading/error states for server data
 * - Kept: UI state (filters, selections, dialog states)
 * - Simplified: No computed state that depends on server data
 */

import { enableMapSet } from 'immer'
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

import { EducationLevel, GradeLevel } from '@prisma/client'

import { StudentStatus } from '@/lib/types/batch'

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
  // SELECTION STATE
  // ============================================================================
  selectedStudentIds: Set<string>
  selectedBatchId: string | null

  // ============================================================================
  // FILTER STATE
  // ============================================================================
  filters: StudentFilters

  // ============================================================================
  // DIALOG/MODAL STATE
  // ============================================================================
  isCreateBatchDialogOpen: boolean
  isAssignStudentsDialogOpen: boolean
  duplicatesExpanded: boolean

  // ============================================================================
  // SELECTION ACTIONS
  // ============================================================================
  selectStudent: (id: string) => void
  deselectStudent: (id: string) => void
  toggleStudent: (id: string) => void
  selectAllStudents: (studentIds: string[]) => void
  clearSelection: () => void
  isStudentSelected: (id: string) => boolean

  selectBatch: (id: string | null) => void

  // ============================================================================
  // FILTER ACTIONS
  // ============================================================================
  setSearchQuery: (query: string) => void
  setSearchFields: (fields: ('name' | 'email' | 'phone')[]) => void

  setBatchFilter: (batchIds: string[]) => void
  toggleBatchFilter: (batchId: string) => void
  setIncludeUnassigned: (include: boolean) => void

  setStatusFilter: (statuses: StudentStatus[]) => void
  toggleStatusFilter: (status: StudentStatus) => void

  setEducationLevelFilter: (levels: EducationLevel[]) => void
  toggleEducationLevelFilter: (level: EducationLevel) => void

  setGradeLevelFilter: (levels: GradeLevel[]) => void
  toggleGradeLevelFilter: (level: GradeLevel) => void

  setDateRangeFilter: (
    from: Date | null,
    to: Date | null,
    field?: 'createdAt' | 'updatedAt' | 'dateOfBirth'
  ) => void
  clearDateRangeFilter: () => void

  resetFilters: () => void
  hasActiveFilters: () => boolean

  // ============================================================================
  // DIALOG/MODAL ACTIONS
  // ============================================================================
  setCreateBatchDialogOpen: (open: boolean) => void
  setAssignStudentsDialogOpen: (open: boolean) => void
  setDuplicatesExpanded: (expanded: boolean) => void

  // ============================================================================
  // UTILITY ACTIONS
  // ============================================================================
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

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useUIStore = create<UIStore>()(
  devtools(
    immer((set, get) => ({
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

      selectStudent: (id) =>
        set((state) => {
          state.selectedStudentIds.add(id)
        }),

      deselectStudent: (id) =>
        set((state) => {
          state.selectedStudentIds.delete(id)
        }),

      toggleStudent: (id) =>
        set((state) => {
          if (state.selectedStudentIds.has(id)) {
            state.selectedStudentIds.delete(id)
          } else {
            state.selectedStudentIds.add(id)
          }
        }),

      selectAllStudents: (studentIds) =>
        set((state) => {
          state.selectedStudentIds = new Set(studentIds)
        }),

      clearSelection: () =>
        set((state) => {
          state.selectedStudentIds = new Set()
        }),

      isStudentSelected: (id) => {
        return get().selectedStudentIds.has(id)
      },

      selectBatch: (id) =>
        set((state) => {
          state.selectedBatchId = id
        }),

      // ========================================================================
      // FILTER ACTIONS - Search
      // ========================================================================

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

      setSearchFields: (fields) =>
        set((state) => {
          if (!state.filters.search) {
            state.filters.search = {
              query: '',
              fields: ['name', 'email', 'phone'],
            }
          }
          state.filters.search.fields = fields
        }),

      // ========================================================================
      // FILTER ACTIONS - Batch
      // ========================================================================

      setBatchFilter: (batchIds) =>
        set((state) => {
          if (!state.filters.batch) {
            state.filters.batch = {
              selected: [],
              includeUnassigned: true,
            }
          }
          state.filters.batch.selected = batchIds
        }),

      toggleBatchFilter: (batchId) =>
        set((state) => {
          if (!state.filters.batch) {
            state.filters.batch = {
              selected: [],
              includeUnassigned: true,
            }
          }
          const index = state.filters.batch.selected.indexOf(batchId)
          if (index > -1) {
            state.filters.batch.selected.splice(index, 1)
          } else {
            state.filters.batch.selected.push(batchId)
          }
        }),

      setIncludeUnassigned: (include) =>
        set((state) => {
          if (!state.filters.batch) {
            state.filters.batch = {
              selected: [],
              includeUnassigned: true,
            }
          }
          state.filters.batch.includeUnassigned = include
        }),

      // ========================================================================
      // FILTER ACTIONS - Status
      // ========================================================================

      setStatusFilter: (statuses) =>
        set((state) => {
          state.filters.status = { selected: statuses }
        }),

      toggleStatusFilter: (status) =>
        set((state) => {
          if (!state.filters.status) {
            state.filters.status = { selected: [] }
          }
          const index = state.filters.status.selected.indexOf(status)
          if (index > -1) {
            state.filters.status.selected.splice(index, 1)
          } else {
            state.filters.status.selected.push(status)
          }
        }),

      // ========================================================================
      // FILTER ACTIONS - Education Level
      // ========================================================================

      setEducationLevelFilter: (levels) =>
        set((state) => {
          state.filters.educationLevel = { selected: levels }
        }),

      toggleEducationLevelFilter: (level) =>
        set((state) => {
          if (!state.filters.educationLevel) {
            state.filters.educationLevel = { selected: [] }
          }
          const index = state.filters.educationLevel.selected.indexOf(level)
          if (index > -1) {
            state.filters.educationLevel.selected.splice(index, 1)
          } else {
            state.filters.educationLevel.selected.push(level)
          }
        }),

      // ========================================================================
      // FILTER ACTIONS - Grade Level
      // ========================================================================

      setGradeLevelFilter: (levels) =>
        set((state) => {
          state.filters.gradeLevel = { selected: levels }
        }),

      toggleGradeLevelFilter: (level) =>
        set((state) => {
          if (!state.filters.gradeLevel) {
            state.filters.gradeLevel = { selected: [] }
          }
          const index = state.filters.gradeLevel.selected.indexOf(level)
          if (index > -1) {
            state.filters.gradeLevel.selected.splice(index, 1)
          } else {
            state.filters.gradeLevel.selected.push(level)
          }
        }),

      // ========================================================================
      // FILTER ACTIONS - Date Range
      // ========================================================================

      setDateRangeFilter: (from, to, field = 'createdAt') =>
        set((state) => {
          state.filters.dateRange = { from, to, field }
        }),

      clearDateRangeFilter: () =>
        set((state) => {
          state.filters.dateRange = {
            from: null,
            to: null,
            field: 'createdAt',
          }
        }),

      // ========================================================================
      // FILTER ACTIONS - Combined
      // ========================================================================

      resetFilters: () =>
        set((state) => {
          state.filters = { ...defaultFilters }
          state.selectedStudentIds = new Set()
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

      // ========================================================================
      // DIALOG/MODAL ACTIONS
      // ========================================================================

      setCreateBatchDialogOpen: (open) =>
        set((state) => {
          state.isCreateBatchDialogOpen = open
        }),

      setAssignStudentsDialogOpen: (open) =>
        set((state) => {
          state.isAssignStudentsDialogOpen = open
        }),

      setDuplicatesExpanded: (expanded) =>
        set((state) => {
          state.duplicatesExpanded = expanded
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
