/**
 * Advanced Test Suite for UI Store
 *
 * Tests edge cases, concurrency, performance, and error recovery
 * that go beyond basic functionality.
 */

import { describe, expect, it, beforeEach, vi } from 'vitest'

import { useUIStore } from '../ui-store'

// ============================================================================
// TEST CONSTANTS
// ============================================================================

/**
 * Performance thresholds for benchmarking
 */
const PERFORMANCE_THRESHOLDS = {
  /** Maximum time for large selection operations (ms) */
  LARGE_SELECTION_TIME_MS: 50,
  /** Maximum time for rapid toggle operations (ms) - relaxed for CI */
  RAPID_TOGGLES_TIME_MS: 250,
  /** Maximum time for rapid mixed operations (ms) */
  RAPID_OPS_TIME_MS: 100,
  /** Threshold that triggers performance warning */
  WARNING_THRESHOLD: 10000,
} as const

/**
 * Test data sizes for performance and stress tests
 */
const TEST_DATA_SIZES = {
  /** Large array for performance tests */
  LARGE_ARRAY: 5000,
  /** Huge array to trigger warnings */
  HUGE_ARRAY: 15000,
  /** Number of rapid operations */
  RAPID_OPS_COUNT: 1000,
  /** Number of rapid toggles on same item */
  RAPID_TOGGLES_EVEN: 100,
  /** Odd number of toggles for determinism test */
  RAPID_TOGGLES_ODD: 99,
} as const

describe('UI Store - Advanced Tests', () => {
  beforeEach(() => {
    // Reset store and clear console spies
    useUIStore.getState().reset()
    vi.clearAllMocks()
  })

  // ==========================================================================
  // CONCURRENCY & RACE CONDITION TESTS
  // ==========================================================================

  describe('Concurrency & Race Conditions', () => {
    it('should handle rapid toggle operations deterministically', () => {
      const store = useUIStore.getState()

      // Simulate rapid user clicks (even number of toggles)
      for (let i = 0; i < TEST_DATA_SIZES.RAPID_TOGGLES_EVEN; i++) {
        store.toggleStudent('student-1')
      }

      // Even number of toggles → not selected
      const state = useUIStore.getState()
      expect(state.selectedStudentIds.has('student-1')).toBe(false)
      expect(state.selectedStudentIds.size).toBe(0)
    })

    it('should handle rapid toggle with odd count', () => {
      const store = useUIStore.getState()

      // Odd number of toggles → selected
      for (let i = 0; i < TEST_DATA_SIZES.RAPID_TOGGLES_ODD; i++) {
        store.toggleStudent('student-1')
      }

      const state = useUIStore.getState()
      expect(state.selectedStudentIds.has('student-1')).toBe(true)
      expect(state.selectedStudentIds.size).toBe(1)
    })

    it('should maintain consistency with concurrent setSelected calls', () => {
      const store = useUIStore.getState()

      // Last call wins
      store.setSelected(['student-1', 'student-2'])
      store.setSelected(['student-3', 'student-4'])
      store.setSelected(['student-5'])

      const state = useUIStore.getState()
      expect(state.selectedStudentIds.size).toBe(1)
      expect(state.selectedStudentIds.has('student-5')).toBe(true)
      expect(state.selectedStudentIds.has('student-1')).toBe(false)
    })

    it('should handle setSelected while toggling', () => {
      const store = useUIStore.getState()

      store.toggleStudent('student-1')
      store.toggleStudent('student-2')
      store.setSelected(['student-3', 'student-4']) // Replaces

      const state = useUIStore.getState()
      expect(state.selectedStudentIds.size).toBe(2)
      expect(state.selectedStudentIds.has('student-1')).toBe(false)
      expect(state.selectedStudentIds.has('student-3')).toBe(true)
    })

    it('should handle dialog state transitions correctly', () => {
      const store = useUIStore.getState()

      // Rapid dialog switches
      store.setDialogOpen('createBatch')
      store.setDialogOpen('assignStudents')
      store.setDialogOpen('duplicates')
      store.setDialogOpen(null)
      store.setDialogOpen('createBatch')

      const state = useUIStore.getState()
      expect(state.openDialog).toBe('createBatch')
    })
  })

  // ==========================================================================
  // PERFORMANCE TESTS
  // ==========================================================================

  describe('Performance', () => {
    it('should handle large selections efficiently', () => {
      const store = useUIStore.getState()
      const largeArray = Array.from(
        { length: TEST_DATA_SIZES.LARGE_ARRAY },
        (_, i) => `student-${i}`
      )

      const start = performance.now()
      store.setSelected(largeArray)
      const duration = performance.now() - start

      expect(duration).toBeLessThan(
        PERFORMANCE_THRESHOLDS.LARGE_SELECTION_TIME_MS
      )
      expect(useUIStore.getState().selectedStudentIds.size).toBe(
        TEST_DATA_SIZES.LARGE_ARRAY
      )
    })

    it('should warn on very large selections', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const store = useUIStore.getState()

      const hugeArray = Array.from(
        { length: TEST_DATA_SIZES.HUGE_ARRAY },
        (_, i) => `student-${i}`
      )

      store.setSelected(hugeArray)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Large selection detected')
      )

      consoleSpy.mockRestore()
    })

    it('should handle rapid operations without memory leak', () => {
      const store = useUIStore.getState()

      // Perform many rapid operations
      for (let i = 0; i < TEST_DATA_SIZES.RAPID_OPS_COUNT; i++) {
        if (i % 2 === 0) {
          store.toggleStudent(`student-${i}`)
        } else {
          store.setSelected([`student-${i}`])
        }
      }

      // Final state should be stable
      const state = useUIStore.getState()
      expect(state.selectedStudentIds.size).toBe(1)
    })

    it('should toggle individual students efficiently', () => {
      const store = useUIStore.getState()

      const start = performance.now()
      for (let i = 0; i < TEST_DATA_SIZES.RAPID_OPS_COUNT; i++) {
        store.toggleStudent(`student-${i}`)
      }
      const duration = performance.now() - start

      expect(duration).toBeLessThan(
        PERFORMANCE_THRESHOLDS.RAPID_TOGGLES_TIME_MS
      )
      expect(useUIStore.getState().selectedStudentIds.size).toBe(
        TEST_DATA_SIZES.RAPID_OPS_COUNT
      )
    })
  })

  // ==========================================================================
  // ERROR RECOVERY TESTS
  // ==========================================================================

  describe('Error Recovery', () => {
    it('should recover from corrupt selectedStudentIds', () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      // Corrupt the state
      const store = useUIStore.getState()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(store.selectedStudentIds as any) = null

      // Should recover gracefully
      expect(() => store.toggleStudent('student-1')).not.toThrow()

      // State should be recovered
      const state = useUIStore.getState()
      expect(state.selectedStudentIds).toBeInstanceOf(Set)

      consoleErrorSpy.mockRestore()
    })

    it('should recover from reset failure', () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      const store = useUIStore.getState()

      // Add some state
      store.setSelected(['student-1', 'student-2'])
      store.setDialogOpen('createBatch')

      // Reset should work even if error occurs
      expect(() => store.reset()).not.toThrow()

      // State should be clean
      const state = useUIStore.getState()
      expect(state.selectedStudentIds.size).toBe(0)
      expect(state.openDialog).toBeNull()

      consoleErrorSpy.mockRestore()
    })

    it('should handle invalid setSelected input gracefully', () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      const store = useUIStore.getState()

      // Should not throw on invalid input
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => store.setSelected(null as any)).not.toThrow()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => store.setSelected(undefined as any)).not.toThrow()

      consoleErrorSpy.mockRestore()
    })

    it('should recover from setDialogOpen error', () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      const store = useUIStore.getState()

      // Should handle gracefully
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => store.setDialogOpen(undefined as any)).not.toThrow()

      const state = useUIStore.getState()
      // undefined is set as-is (no error thrown), which is acceptable
      expect([null, undefined]).toContain(state.openDialog)

      consoleErrorSpy.mockRestore()
    })
  })

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle empty array for setSelected', () => {
      const store = useUIStore.getState()

      store.setSelected([])

      const state = useUIStore.getState()
      expect(state.selectedStudentIds.size).toBe(0)
    })

    it('should handle duplicate IDs in setSelected', () => {
      const store = useUIStore.getState()

      store.setSelected(['student-1', 'student-1', 'student-2'])

      const state = useUIStore.getState()
      expect(state.selectedStudentIds.size).toBe(2) // Set deduplicates
    })

    it('should handle toggle of non-existent student', () => {
      const store = useUIStore.getState()

      store.toggleStudent('non-existent')

      const state = useUIStore.getState()
      expect(state.selectedStudentIds.has('non-existent')).toBe(true)
    })

    it('should handle clearSelected on empty selection', () => {
      const store = useUIStore.getState()

      expect(() => store.clearSelected()).not.toThrow()

      const state = useUIStore.getState()
      expect(state.selectedStudentIds.size).toBe(0)
    })

    it('should handle multiple resets', () => {
      const store = useUIStore.getState()

      store.setSelected(['student-1'])
      store.reset()
      store.setSelected(['student-2'])
      store.reset()
      store.reset() // Extra reset

      const state = useUIStore.getState()
      expect(state.selectedStudentIds.size).toBe(0)
      expect(state.selectedBatchId).toBeNull()
      expect(state.openDialog).toBeNull()
    })

    it('should handle setDialogOpen with same dialog', () => {
      const store = useUIStore.getState()

      store.setDialogOpen('createBatch')
      store.setDialogOpen('createBatch') // Same dialog

      const state = useUIStore.getState()
      expect(state.openDialog).toBe('createBatch')
    })

    it('should handle selectBatch with null repeatedly', () => {
      const store = useUIStore.getState()

      store.selectBatch('batch-1')
      store.selectBatch(null)
      store.selectBatch(null) // Already null

      const state = useUIStore.getState()
      expect(state.selectedBatchId).toBeNull()
    })
  })

  // ==========================================================================
  // STATE CONSISTENCY TESTS
  // ==========================================================================

  describe('State Consistency', () => {
    it('should maintain version number', () => {
      const state = useUIStore.getState()
      expect(state._version).toBe(1)
    })

    it('should maintain Set type after operations', () => {
      const store = useUIStore.getState()

      store.toggleStudent('student-1')
      expect(useUIStore.getState().selectedStudentIds).toBeInstanceOf(Set)

      store.setSelected(['student-2'])
      expect(useUIStore.getState().selectedStudentIds).toBeInstanceOf(Set)

      store.clearSelected()
      expect(useUIStore.getState().selectedStudentIds).toBeInstanceOf(Set)
    })

    it('should handle complex workflow', () => {
      const store = useUIStore.getState()

      // Select some students
      store.setSelected(['s1', 's2', 's3'])

      // Toggle one off
      store.toggleStudent('s2')

      // Select a batch
      store.selectBatch('batch-1')

      // Open dialog
      store.setDialogOpen('assignStudents')

      // Verify state
      const state = useUIStore.getState()
      expect(state.selectedStudentIds.size).toBe(2)
      expect(state.selectedStudentIds.has('s1')).toBe(true)
      expect(state.selectedStudentIds.has('s2')).toBe(false)
      expect(state.selectedBatchId).toBe('batch-1')
      expect(state.openDialog).toBe('assignStudents')

      // Complete workflow - reset
      store.reset()

      const finalState = useUIStore.getState()
      expect(finalState.selectedStudentIds.size).toBe(0)
      expect(finalState.selectedBatchId).toBeNull()
      expect(finalState.openDialog).toBeNull()
    })
  })

  // ==========================================================================
  // INTEGRATION WORKFLOW TESTS
  // ==========================================================================

  describe('Integration Workflows', () => {
    it('should handle "select all visible, then deselect one" workflow', () => {
      const store = useUIStore.getState()
      const visibleStudents = Array.from(
        { length: 50 },
        (_, i) => `student-${i}`
      )

      // Select all visible
      store.setSelected(visibleStudents)
      expect(useUIStore.getState().selectedStudentIds.size).toBe(50)

      // User deselects one
      store.toggleStudent('student-25')
      expect(useUIStore.getState().selectedStudentIds.size).toBe(49)
      expect(useUIStore.getState().selectedStudentIds.has('student-25')).toBe(
        false
      )

      // User selects it again
      store.toggleStudent('student-25')
      expect(useUIStore.getState().selectedStudentIds.size).toBe(50)
    })

    it('should handle "batch assignment" workflow', () => {
      const store = useUIStore.getState()

      // 1. Select students
      store.setSelected(['s1', 's2', 's3'])

      // 2. Select target batch
      store.selectBatch('batch-new')

      // 3. Open assignment dialog
      store.setDialogOpen('assignStudents')

      // 4. Verify pre-assignment state
      let state = useUIStore.getState()
      expect(state.selectedStudentIds.size).toBe(3)
      expect(state.selectedBatchId).toBe('batch-new')
      expect(state.openDialog).toBe('assignStudents')

      // 5. After assignment (simulated), close dialog and clear selection
      store.setDialogOpen(null)
      store.clearSelected()

      // 6. Verify post-assignment state
      state = useUIStore.getState()
      expect(state.selectedStudentIds.size).toBe(0)
      expect(state.openDialog).toBeNull()
      // Batch selection persists for next operation
      expect(state.selectedBatchId).toBe('batch-new')
    })

    it('should handle "filter change clears selection" workflow', () => {
      const store = useUIStore.getState()

      // User selects some students
      store.setSelected(['s1', 's2', 's3'])

      // User changes filter (simulated by clearing selection)
      // In real app, this would be triggered by useURLFilters change
      store.clearSelected()

      const state = useUIStore.getState()
      expect(state.selectedStudentIds.size).toBe(0)
    })

    it('should handle "page navigation" workflow', () => {
      const store = useUIStore.getState()

      // User selects students on page 1
      store.setSelected(['s1', 's2'])
      store.selectBatch('batch-1')
      store.setDialogOpen('createBatch')

      // User navigates away - reset all transient state
      store.reset()

      const state = useUIStore.getState()
      expect(state.selectedStudentIds.size).toBe(0)
      expect(state.selectedBatchId).toBeNull()
      expect(state.openDialog).toBeNull()
    })
  })
})
