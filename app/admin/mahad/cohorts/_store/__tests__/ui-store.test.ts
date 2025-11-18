/**
 * TDD Test Suite for Minimal UI-Only Store
 *
 * This test suite defines the DESIRED interface for the simplified Zustand store.
 * Tests are written FIRST to define behavior, then implementation follows.
 *
 * Goal: Remove all filter state (now managed by URL params)
 * Keep: Only transient UI state (selection, dialogs, batch selection)
 */

import { describe, expect, it, beforeEach } from 'vitest'

import { useUIStore } from '../ui-store'

describe('UIStore - Minimal UI-Only State', () => {
  // Reset store before each test
  beforeEach(() => {
    useUIStore.getState().reset()
  })

  // ==========================================================================
  // STUDENT SELECTION TESTS
  // ==========================================================================

  describe('Student Selection', () => {
    it('should initialize with empty selection', () => {
      const store = useUIStore.getState()

      expect(store.selectedStudentIds).toBeInstanceOf(Set)
      expect(store.selectedStudentIds.size).toBe(0)
    })

    it('should toggle student selection on', () => {
      const store = useUIStore.getState()

      store.toggleStudent('student-1')

      expect(useUIStore.getState().selectedStudentIds.has('student-1')).toBe(
        true
      )
      expect(useUIStore.getState().selectedStudentIds.size).toBe(1)
    })

    it('should toggle student selection off', () => {
      const store = useUIStore.getState()

      store.toggleStudent('student-1')
      store.toggleStudent('student-1')

      expect(useUIStore.getState().selectedStudentIds.has('student-1')).toBe(
        false
      )
      expect(useUIStore.getState().selectedStudentIds.size).toBe(0)
    })

    it('should toggle multiple students independently', () => {
      const store = useUIStore.getState()

      store.toggleStudent('student-1')
      store.toggleStudent('student-2')
      store.toggleStudent('student-3')

      const state = useUIStore.getState()
      expect(state.selectedStudentIds.has('student-1')).toBe(true)
      expect(state.selectedStudentIds.has('student-2')).toBe(true)
      expect(state.selectedStudentIds.has('student-3')).toBe(true)
      expect(state.selectedStudentIds.size).toBe(3)
    })

    it('should set multiple students selected at once', () => {
      const store = useUIStore.getState()
      const studentIds = ['student-1', 'student-2', 'student-3']

      store.setSelected(studentIds)

      const state = useUIStore.getState()
      expect(state.selectedStudentIds.size).toBe(3)
      studentIds.forEach((id) => {
        expect(state.selectedStudentIds.has(id)).toBe(true)
      })
    })

    it('should replace previous selection when setting new selection', () => {
      const store = useUIStore.getState()

      store.setSelected(['student-1', 'student-2'])
      store.setSelected(['student-3', 'student-4'])

      const state = useUIStore.getState()
      expect(state.selectedStudentIds.size).toBe(2)
      expect(state.selectedStudentIds.has('student-1')).toBe(false)
      expect(state.selectedStudentIds.has('student-2')).toBe(false)
      expect(state.selectedStudentIds.has('student-3')).toBe(true)
      expect(state.selectedStudentIds.has('student-4')).toBe(true)
    })

    it('should clear all selections', () => {
      const store = useUIStore.getState()

      store.setSelected(['student-1', 'student-2', 'student-3'])
      store.clearSelected()

      expect(useUIStore.getState().selectedStudentIds.size).toBe(0)
    })

    it('should handle Set operations correctly with immer', () => {
      const store = useUIStore.getState()

      store.toggleStudent('student-1')
      store.toggleStudent('student-2')

      // Should create new Set reference (immer immutability)
      const state = useUIStore.getState()
      expect(state.selectedStudentIds).toBeInstanceOf(Set)
      expect(state.selectedStudentIds.has('student-1')).toBe(true)
      expect(state.selectedStudentIds.has('student-2')).toBe(true)
    })
  })

  // ==========================================================================
  // DIALOG MANAGEMENT TESTS
  // ==========================================================================

  describe('Dialog Management', () => {
    it('should initialize with no dialog open', () => {
      const store = useUIStore.getState()

      expect(store.openDialog).toBeNull()
    })

    it('should open create batch dialog', () => {
      const store = useUIStore.getState()

      store.setDialogOpen('createBatch')

      expect(useUIStore.getState().openDialog).toBe('createBatch')
    })

    it('should open assign students dialog', () => {
      const store = useUIStore.getState()

      store.setDialogOpen('assignStudents')

      expect(useUIStore.getState().openDialog).toBe('assignStudents')
    })

    it('should open duplicates dialog', () => {
      const store = useUIStore.getState()

      store.setDialogOpen('duplicates')

      expect(useUIStore.getState().openDialog).toBe('duplicates')
    })

    it('should close dialog by setting to null', () => {
      const store = useUIStore.getState()

      store.setDialogOpen('createBatch')
      store.setDialogOpen(null)

      expect(useUIStore.getState().openDialog).toBeNull()
    })

    it('should only allow one dialog open at a time', () => {
      const store = useUIStore.getState()

      store.setDialogOpen('createBatch')
      store.setDialogOpen('assignStudents')

      expect(useUIStore.getState().openDialog).toBe('assignStudents')
    })

    it('should allow switching between dialogs', () => {
      const store = useUIStore.getState()

      store.setDialogOpen('createBatch')
      expect(useUIStore.getState().openDialog).toBe('createBatch')

      store.setDialogOpen('duplicates')
      expect(useUIStore.getState().openDialog).toBe('duplicates')

      store.setDialogOpen('assignStudents')
      expect(useUIStore.getState().openDialog).toBe('assignStudents')
    })
  })

  // ==========================================================================
  // BATCH SELECTION TESTS
  // ==========================================================================

  describe('Batch Selection', () => {
    it('should initialize with no batch selected', () => {
      const store = useUIStore.getState()

      expect(store.selectedBatchId).toBeNull()
    })

    it('should select a batch', () => {
      const store = useUIStore.getState()

      store.selectBatch('batch-1')

      expect(useUIStore.getState().selectedBatchId).toBe('batch-1')
    })

    it('should change batch selection', () => {
      const store = useUIStore.getState()

      store.selectBatch('batch-1')
      store.selectBatch('batch-2')

      expect(useUIStore.getState().selectedBatchId).toBe('batch-2')
    })

    it('should clear batch selection', () => {
      const store = useUIStore.getState()

      store.selectBatch('batch-1')
      store.selectBatch(null)

      expect(useUIStore.getState().selectedBatchId).toBeNull()
    })
  })

  // ==========================================================================
  // STORE RESET TESTS
  // ==========================================================================

  describe('Store Reset', () => {
    it('should reset all UI state', () => {
      const store = useUIStore.getState()

      // Set up some state
      store.setSelected(['student-1', 'student-2'])
      store.selectBatch('batch-1')
      store.setDialogOpen('createBatch')

      // Verify state is set
      let state = useUIStore.getState()
      expect(state.selectedStudentIds.size).toBe(2)
      expect(state.selectedBatchId).toBe('batch-1')
      expect(state.openDialog).toBe('createBatch')

      // Reset
      store.reset()

      // Verify everything is reset
      state = useUIStore.getState()
      expect(state.selectedStudentIds.size).toBe(0)
      expect(state.selectedBatchId).toBeNull()
      expect(state.openDialog).toBeNull()
    })

    it('should handle multiple resets', () => {
      const store = useUIStore.getState()

      store.setSelected(['student-1'])
      store.reset()
      store.setSelected(['student-2'])
      store.reset()

      const state = useUIStore.getState()
      expect(state.selectedStudentIds.size).toBe(0)
      expect(state.selectedBatchId).toBeNull()
      expect(state.openDialog).toBeNull()
    })
  })

  // ==========================================================================
  // SELECTOR TESTS
  // ==========================================================================

  describe('Selectors', () => {
    it('should select student IDs via store selector', () => {
      const store = useUIStore.getState()

      store.setSelected(['student-1', 'student-2'])

      const selectedIds = useUIStore.getState().selectedStudentIds
      expect(selectedIds.size).toBe(2)
    })

    it('should select dialog state via store selector', () => {
      const store = useUIStore.getState()

      store.setDialogOpen('createBatch')

      const dialog = useUIStore.getState().openDialog
      expect(dialog).toBe('createBatch')
    })

    it('should select batch ID via store selector', () => {
      const store = useUIStore.getState()

      store.selectBatch('batch-1')

      const batchId = useUIStore.getState().selectedBatchId
      expect(batchId).toBe('batch-1')
    })
  })

  // ==========================================================================
  // NEGATIVE TESTS - What should NOT exist
  // ==========================================================================

  describe('No Filter State (Negative Tests)', () => {
    it('should NOT have filters property in store', () => {
      const store = useUIStore.getState()

      expect(store).not.toHaveProperty('filters')
    })

    it('should NOT have updateFilters action', () => {
      const store = useUIStore.getState()

      expect(store).not.toHaveProperty('updateFilters')
    })

    it('should NOT have toggleFilter action', () => {
      const store = useUIStore.getState()

      expect(store).not.toHaveProperty('toggleFilter')
    })

    it('should NOT have setSearchQuery action', () => {
      const store = useUIStore.getState()

      expect(store).not.toHaveProperty('setSearchQuery')
    })

    it('should NOT have resetFilters action', () => {
      const store = useUIStore.getState()

      expect(store).not.toHaveProperty('resetFilters')
    })

    it('should NOT have old dialog boolean properties', () => {
      const store = useUIStore.getState()

      expect(store).not.toHaveProperty('isCreateBatchDialogOpen')
      expect(store).not.toHaveProperty('isAssignStudentsDialogOpen')
      expect(store).not.toHaveProperty('duplicatesExpanded')
    })

    it('should NOT have old selection action names', () => {
      const store = useUIStore.getState()

      expect(store).not.toHaveProperty('toggleStudentSelection')
      expect(store).not.toHaveProperty('setStudentSelection')
      expect(store).not.toHaveProperty('clearStudentSelection')
    })
  })

  // ==========================================================================
  // INTEGRATION TESTS
  // ==========================================================================

  describe('Integration Scenarios', () => {
    it('should handle typical "select all" workflow', () => {
      const store = useUIStore.getState()
      const allStudentIds = ['s1', 's2', 's3', 's4', 's5']

      // Select all
      store.setSelected(allStudentIds)
      expect(useUIStore.getState().selectedStudentIds.size).toBe(5)

      // Deselect one
      store.toggleStudent('s3')
      expect(useUIStore.getState().selectedStudentIds.size).toBe(4)
      expect(useUIStore.getState().selectedStudentIds.has('s3')).toBe(false)

      // Clear all
      store.clearSelected()
      expect(useUIStore.getState().selectedStudentIds.size).toBe(0)
    })

    it('should handle "assign students to batch" workflow', () => {
      const store = useUIStore.getState()

      // Select students
      store.setSelected(['s1', 's2', 's3'])

      // Select target batch
      store.selectBatch('batch-1')

      // Open assign dialog
      store.setDialogOpen('assignStudents')

      let state = useUIStore.getState()
      expect(state.selectedStudentIds.size).toBe(3)
      expect(state.selectedBatchId).toBe('batch-1')
      expect(state.openDialog).toBe('assignStudents')

      // After successful assignment, close dialog and clear selection
      store.setDialogOpen(null)
      store.clearSelected()

      state = useUIStore.getState()
      expect(state.selectedStudentIds.size).toBe(0)
      expect(state.openDialog).toBeNull()
    })

    it('should handle "create new batch" workflow', () => {
      const store = useUIStore.getState()

      // Open create dialog
      store.setDialogOpen('createBatch')

      expect(useUIStore.getState().openDialog).toBe('createBatch')

      // After creating batch, close dialog
      store.setDialogOpen(null)

      expect(useUIStore.getState().openDialog).toBeNull()
    })

    it('should handle navigation away (reset)', () => {
      const store = useUIStore.getState()

      // User has been working with UI
      store.setSelected(['s1', 's2'])
      store.selectBatch('batch-1')
      store.setDialogOpen('duplicates')

      // User navigates away - reset all transient UI state
      store.reset()

      const state = useUIStore.getState()
      expect(state.selectedStudentIds.size).toBe(0)
      expect(state.selectedBatchId).toBeNull()
      expect(state.openDialog).toBeNull()
    })
  })
})
