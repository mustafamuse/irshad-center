/**
 * Minimal UI-Only State Store for Cohorts Management
 *
 * @module ui-store
 * @description
 * This store ONLY manages transient UI state that doesn't need URL persistence:
 * - Student selection for bulk operations (cleared on navigation)
 * - Dialog visibility states
 * - Batch selection for management operations
 *
 * **IMPORTANT**: Filter state is NOT managed here.
 * All filters are managed via URL params using the {@link useURLFilters} hook.
 *
 * @example
 * ```tsx
 * // Toggle individual student selection
 * const toggleStudent = useUIStore(s => s.toggleStudent)
 * toggleStudent('student-123')
 *
 * // Bulk select all visible students
 * const setSelected = useUIStore(s => s.setSelected)
 * setSelected(['student-1', 'student-2', 'student-3'])
 *
 * // Open a dialog
 * const setDialogOpen = useUIStore(s => s.setDialogOpen)
 * setDialogOpen('createBatch')
 * ```
 *
 * @see {@link useURLFilters} for filter state management
 * @see MIGRATION.md for upgrading from old store
 * @version 1.0.0
 */

import { enableMapSet } from 'immer'
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

// Enable Immer MapSet plugin for using Set in the store
enableMapSet()

/**
 * Store version for future migrations
 * Increment when making breaking changes to state structure
 */
const STORE_VERSION = 1

/**
 * Maximum safe selection size to prevent memory issues
 * Warning logged if exceeded
 */
const MAX_SAFE_SELECTION_SIZE = 10000

/**
 * Development mode flag for enhanced error logging
 */
const isDev = process.env.NODE_ENV === 'development'

// ============================================================================
// TYPES
// ============================================================================

/**
 * Dialog type discriminator
 * Only one dialog can be open at a time
 *
 * @public
 */
export type DialogType = 'createBatch' | 'assignStudents' | 'duplicates' | null

/**
 * UI Store Interface
 *
 * Manages all transient UI state for the cohorts management system.
 * State is intentionally ephemeral and cleared on navigation/refresh.
 *
 * @interface UIStore
 */
interface UIStore {
  // ============================================================================
  // STATE
  // ============================================================================

  /**
   * Store version number for migration support
   * @internal
   */
  _version: number

  /**
   * Set of selected student IDs for bulk operations
   *
   * Uses Set for O(1) lookup and modification performance.
   * Cleared on navigation or manual reset.
   *
   * @example
   * ```tsx
   * const selectedIds = useUIStore(s => s.selectedStudentIds)
   * const isSelected = selectedIds.has('student-123')
   * ```
   */
  selectedStudentIds: Set<string>

  /**
   * Currently selected batch ID for batch management
   *
   * Used when performing batch-level operations.
   * Set to null when no batch is selected.
   */
  selectedBatchId: string | null

  /**
   * Currently open dialog (only one at a time)
   *
   * Enforces single dialog policy. Opening a new dialog
   * automatically closes any currently open dialog.
   */
  openDialog: DialogType

  // ============================================================================
  // ACTIONS
  // ============================================================================

  /**
   * Toggles selection state for a single student
   *
   * @param id - Student ID to toggle
   * @complexity O(1)
   * @mutates selectedStudentIds
   *
   * @example
   * ```tsx
   * const toggleStudent = useUIStore(s => s.toggleStudent)
   * toggleStudent('student-123') // Adds if not selected, removes if selected
   * ```
   */
  toggleStudent: (id: string) => void

  /**
   * Sets selection to specific student IDs (replaces current selection)
   *
   * @param ids - Array of student IDs to select
   * @complexity O(n) where n is ids.length
   * @mutates selectedStudentIds
   * @throws Warning if ids.length > MAX_SAFE_SELECTION_SIZE
   *
   * @example
   * ```tsx
   * const setSelected = useUIStore(s => s.setSelected)
   * setSelected(['student-1', 'student-2', 'student-3'])
   * ```
   */
  setSelected: (ids: string[]) => void

  /**
   * Clears all student selections
   *
   * @complexity O(1)
   * @mutates selectedStudentIds
   *
   * @example
   * ```tsx
   * const clearSelected = useUIStore(s => s.clearSelected)
   * clearSelected()
   * ```
   */
  clearSelected: () => void

  /**
   * Selects a batch for management operations
   *
   * @param id - Batch ID to select, or null to clear selection
   * @mutates selectedBatchId
   *
   * @example
   * ```tsx
   * const selectBatch = useUIStore(s => s.selectBatch)
   * selectBatch('batch-456')
   * selectBatch(null) // Clear selection
   * ```
   */
  selectBatch: (id: string | null) => void

  /**
   * Opens a dialog (or closes all dialogs if null)
   *
   * Only one dialog can be open at a time. Opening a new dialog
   * automatically closes any currently open dialog.
   *
   * @param dialog - Dialog to open, or null to close all
   * @mutates openDialog
   *
   * @example
   * ```tsx
   * const setDialogOpen = useUIStore(s => s.setDialogOpen)
   * setDialogOpen('assignStudents') // Closes create batch, opens assign students
   * setDialogOpen(null)             // Closes all dialogs
   * ```
   */
  setDialogOpen: (dialog: DialogType) => void

  /**
   * Resets all UI state to initial values
   *
   * Clears all selections and closes all dialogs.
   * Useful when navigating away or after completing operations.
   *
   * @mutates All state properties
   * @throws Never - includes error recovery
   *
   * @example
   * ```tsx
   * const reset = useUIStore(s => s.reset)
   * reset() // Clean slate
   * ```
   */
  reset: () => void
}

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

/**
 * Cohorts UI Store
 *
 * Created with Zustand + Immer + DevTools for excellent DX.
 * State updates use immutable patterns via Immer middleware.
 *
 * @see https://github.com/pmndrs/zustand
 */
export const useUIStore = create<UIStore>()(
  devtools(
    immer((set) => ({
      // Initial state
      _version: STORE_VERSION,
      selectedStudentIds: new Set(),
      selectedBatchId: null,
      openDialog: null,

      // ========================================================================
      // SELECTION ACTIONS
      // ========================================================================

      toggleStudent: (id) =>
        set((state) => {
          try {
            if (state.selectedStudentIds.has(id)) {
              state.selectedStudentIds.delete(id)
            } else {
              state.selectedStudentIds.add(id)
            }
          } catch (error) {
            console.error('toggleStudent failed:', error)
            if (isDev) {
              console.error('Debug info:', {
                studentId: id,
                currentSetSize: state.selectedStudentIds?.size || 0,
                error: error instanceof Error ? error.message : String(error),
              })
            }
            // Recover by ensuring Set exists
            state.selectedStudentIds = new Set()
          }
        }),

      setSelected: (ids) =>
        set((state) => {
          try {
            // Safety check for large selections
            if (ids.length > MAX_SAFE_SELECTION_SIZE) {
              console.warn(
                `Large selection detected: ${ids.length} students. ` +
                  `This may impact performance. Consider pagination.`
              )
            }

            state.selectedStudentIds = new Set(ids)
          } catch (error) {
            console.error('setSelected failed:', error)
            if (isDev) {
              console.error('Debug info:', {
                idsLength: ids?.length || 0,
                idsType: typeof ids,
                error: error instanceof Error ? error.message : String(error),
              })
            }
            // Recover with empty selection
            state.selectedStudentIds = new Set()
          }
        }),

      clearSelected: () =>
        set((state) => {
          try {
            state.selectedStudentIds = new Set()
          } catch (error) {
            console.error('clearSelected failed:', error)
            if (isDev) {
              console.error('Debug info:', {
                error: error instanceof Error ? error.message : String(error),
              })
            }
            state.selectedStudentIds = new Set()
          }
        }),

      // ========================================================================
      // BATCH SELECTION
      // ========================================================================

      selectBatch: (id) =>
        set((state) => {
          try {
            state.selectedBatchId = id
          } catch (error) {
            console.error('selectBatch failed:', error)
            if (isDev) {
              console.error('Debug info:', {
                batchId: id,
                error: error instanceof Error ? error.message : String(error),
              })
            }
            state.selectedBatchId = null
          }
        }),

      // ========================================================================
      // DIALOG ACTIONS
      // ========================================================================

      setDialogOpen: (dialog) =>
        set((state) => {
          try {
            state.openDialog = dialog
          } catch (error) {
            console.error('setDialogOpen failed:', error)
            if (isDev) {
              console.error('Debug info:', {
                dialog,
                previousDialog: state.openDialog,
                error: error instanceof Error ? error.message : String(error),
              })
            }
            state.openDialog = null
          }
        }),

      // ========================================================================
      // UTILITY ACTIONS
      // ========================================================================

      reset: () =>
        set((state) => {
          try {
            state.selectedStudentIds = new Set()
            state.selectedBatchId = null
            state.openDialog = null
          } catch (error) {
            console.error('Store reset failed:', error)
            if (isDev) {
              console.error('Debug info:', {
                stateBeforeReset: {
                  selectionSize: state.selectedStudentIds?.size || 0,
                  batchId: state.selectedBatchId,
                  dialog: state.openDialog,
                },
                error: error instanceof Error ? error.message : String(error),
              })
            }
            // Force full reset to known good state
            return {
              _version: STORE_VERSION,
              selectedStudentIds: new Set(),
              selectedBatchId: null,
              openDialog: null,
              // Re-bind all actions
              toggleStudent: state.toggleStudent,
              setSelected: state.setSelected,
              clearSelected: state.clearSelected,
              selectBatch: state.selectBatch,
              setDialogOpen: state.setDialogOpen,
              reset: state.reset,
            }
          }
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

/**
 * Hook to access selected student IDs
 *
 * @returns Set of selected student IDs
 * @example
 * ```tsx
 * const selectedIds = useSelectedStudents()
 * const count = selectedIds.size
 * const isSelected = selectedIds.has('student-123')
 * ```
 */
export const useSelectedStudents = () =>
  useUIStore((state) => state.selectedStudentIds)

/**
 * Hook to access selected batch ID
 *
 * @returns Currently selected batch ID or null
 * @example
 * ```tsx
 * const batchId = useSelectedBatch()
 * if (batchId) {
 *   // Batch is selected
 * }
 * ```
 */
export const useSelectedBatch = () =>
  useUIStore((state) => state.selectedBatchId)

/**
 * Hook to access current dialog state
 *
 * @returns Currently open dialog or null
 * @example
 * ```tsx
 * const dialog = useDialogState()
 * const isCreateBatchOpen = dialog === 'createBatch'
 * ```
 */
export const useDialogState = () => useUIStore((state) => state.openDialog)

// ============================================================================
// LEGACY COMPATIBILITY LAYER
// ============================================================================

/**
 * Backward compatibility helpers for gradual migration from old store
 *
 * @deprecated Use direct store actions instead. This will be removed in v2.0.
 * @see MIGRATION.md for migration guide
 *
 * Maps old action names to new minimal store actions:
 * - `selectStudent` → `toggleStudent`
 * - `selectAllStudents` → `setSelected`
 * - `setCreateBatchDialogOpen` → `setDialogOpen('createBatch')`
 *
 * @example
 * ```tsx
 * // OLD (deprecated)
 * const { selectStudent } = useLegacyActions()
 * selectStudent('student-123')
 *
 * // NEW (recommended)
 * const toggleStudent = useUIStore(s => s.toggleStudent)
 * toggleStudent('student-123')
 * ```
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

/**
 * Checks if create batch dialog is open
 *
 * @deprecated Use `useDialogState() === 'createBatch'` instead
 * @returns true if create batch dialog is open
 */
export const useCreateBatchDialogState = () =>
  useUIStore((state) => state.openDialog === 'createBatch')

/**
 * Checks if assign students dialog is open
 *
 * @deprecated Use `useDialogState() === 'assignStudents'` instead
 * @returns true if assign students dialog is open
 */
export const useAssignStudentsDialogState = () =>
  useUIStore((state) => state.openDialog === 'assignStudents')

/**
 * Checks if duplicates detector is expanded
 *
 * @deprecated Use `useDialogState() === 'duplicates'` instead
 * @returns true if duplicates detector is expanded
 */
export const useDuplicatesExpandedState = () =>
  useUIStore((state) => state.openDialog === 'duplicates')
