/**
 * Minimal UI-Only State Store
 *
 * This store ONLY manages transient UI state that doesn't need URL persistence:
 * - Student selection (cleared on navigation)
 * - Dialog visibility
 * - Batch selection (for batch management operations)
 *
 * FILTERS ARE NOT HERE - They're managed by URL params via useURLFilters hook
 */

import { enableMapSet } from 'immer'
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

// Enable Immer MapSet plugin for using Set in the store
enableMapSet()

// ============================================================================
// TYPES
// ============================================================================

interface UIStore {
  // ============================================================================
  // STATE
  // ============================================================================

  // Selection (transient - lost on refresh is acceptable)
  selectedStudentIds: Set<string>

  // Batch selection (for batch management operations)
  selectedBatchId: string | null

  // Dialog states (only one dialog can be open at a time)
  openDialog: 'createBatch' | 'assignStudents' | 'duplicates' | null

  // ============================================================================
  // ACTIONS
  // ============================================================================

  // Selection actions
  toggleStudent: (id: string) => void
  setSelected: (ids: string[]) => void
  clearSelected: () => void

  // Batch selection
  selectBatch: (id: string | null) => void

  // Dialog actions
  setDialogOpen: (
    dialog: 'createBatch' | 'assignStudents' | 'duplicates' | null
  ) => void

  // Utility
  reset: () => void
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
      openDialog: null,

      // ========================================================================
      // SELECTION ACTIONS
      // ========================================================================

      toggleStudent: (id) =>
        set((state) => {
          if (state.selectedStudentIds.has(id)) {
            state.selectedStudentIds.delete(id)
          } else {
            state.selectedStudentIds.add(id)
          }
        }),

      setSelected: (ids) =>
        set((state) => {
          state.selectedStudentIds = new Set(ids)
        }),

      clearSelected: () =>
        set((state) => {
          state.selectedStudentIds = new Set()
        }),

      // ========================================================================
      // BATCH SELECTION
      // ========================================================================

      selectBatch: (id) =>
        set((state) => {
          state.selectedBatchId = id
        }),

      // ========================================================================
      // DIALOG ACTIONS
      // ========================================================================

      setDialogOpen: (dialog) =>
        set((state) => {
          state.openDialog = dialog
        }),

      // ========================================================================
      // UTILITY ACTIONS
      // ========================================================================

      reset: () =>
        set((state) => {
          state.selectedStudentIds = new Set()
          state.selectedBatchId = null
          state.openDialog = null
        }),
    })),
    {
      name: 'cohorts-ui-store',
    }
  )
)

// ============================================================================
// SELECTORS (for convenience)
// ============================================================================

export const useSelectedStudents = () =>
  useUIStore((state) => state.selectedStudentIds)

export const useSelectedBatch = () =>
  useUIStore((state) => state.selectedBatchId)

export const useDialogState = () => useUIStore((state) => state.openDialog)

// ============================================================================
// LEGACY COMPATIBILITY LAYER
// ============================================================================

/**
 * Backward compatibility helpers for gradual migration
 * Maps old action names to new minimal store actions
 */
export const useLegacyActions = () => {
  const store = useUIStore()
  return {
    // Selection actions (old names → new names)
    selectStudent: (id: string) => store.toggleStudent(id),
    deselectStudent: (id: string) => store.toggleStudent(id),
    toggleStudent: (id: string) => store.toggleStudent(id),
    selectAllStudents: (ids: string[]) => store.setSelected(ids),
    clearSelection: () => store.clearSelected(),

    // Dialog actions (old API → new unified API)
    setCreateBatchDialogOpen: (open: boolean) =>
      store.setDialogOpen(open ? 'createBatch' : null),
    setAssignStudentsDialogOpen: (open: boolean) =>
      store.setDialogOpen(open ? 'assignStudents' : null),
    setDuplicatesExpanded: (open: boolean) =>
      store.setDialogOpen(open ? 'duplicates' : null),
  }
}

// Backward compatibility selectors
export const useCreateBatchDialogState = () =>
  useUIStore((state) => state.openDialog === 'createBatch')

export const useAssignStudentsDialogState = () =>
  useUIStore((state) => state.openDialog === 'assignStudents')

export const useDuplicatesExpandedState = () =>
  useUIStore((state) => state.openDialog === 'duplicates')
