/**
 * UI Store Tests
 *
 * Tests for the Zustand UI state store managing filters, selections, and dialog states.
 */

import { EducationLevel, GradeLevel } from '@prisma/client'
import { describe, it, expect, beforeEach } from 'vitest'

import { useUIStore } from '@/app/batches/store/ui-store'
import { StudentStatus } from '@/lib/types/batch'

describe('UI Store', () => {
  beforeEach(() => {
    // Reset store state before each test
    useUIStore.getState().reset()
  })

  describe('Student Selection', () => {
    it('should select and deselect students', () => {
      const store = useUIStore.getState()

      // Select student
      store.selectStudent('student-1')
      expect(store.isStudentSelected('student-1')).toBe(true)

      // Deselect student
      store.deselectStudent('student-1')
      expect(store.isStudentSelected('student-1')).toBe(false)
    })

    it('should toggle student selection', () => {
      const store = useUIStore.getState()

      // Toggle on
      store.toggleStudent('student-1')
      expect(store.isStudentSelected('student-1')).toBe(true)

      // Toggle off
      store.toggleStudent('student-1')
      expect(store.isStudentSelected('student-1')).toBe(false)
    })

    it('should select all students', () => {
      const store = useUIStore.getState()
      const studentIds = ['student-1', 'student-2', 'student-3']

      store.selectAllStudents(studentIds)

      studentIds.forEach((id) => {
        expect(store.isStudentSelected(id)).toBe(true)
      })
    })

    it('should clear all selections', () => {
      const store = useUIStore.getState()

      store.selectAllStudents(['student-1', 'student-2', 'student-3'])
      store.clearSelection()

      expect(store.isStudentSelected('student-1')).toBe(false)
      expect(store.isStudentSelected('student-2')).toBe(false)
      expect(store.isStudentSelected('student-3')).toBe(false)
    })

    it('should track selected student IDs as a Set', () => {
      const store = useUIStore.getState()

      store.selectStudent('student-1')
      store.selectStudent('student-2')

      const selectedIds = useUIStore.getState().selectedStudentIds
      expect(selectedIds).toBeInstanceOf(Set)
      expect(selectedIds.size).toBe(2)
      expect(selectedIds.has('student-1')).toBe(true)
      expect(selectedIds.has('student-2')).toBe(true)
    })
  })

  describe('Batch Selection', () => {
    it('should select a batch', () => {
      const store = useUIStore.getState()

      store.selectBatch('batch-1')
      expect(store.selectedBatchId).toBe('batch-1')
    })

    it('should clear batch selection with null', () => {
      const store = useUIStore.getState()

      store.selectBatch('batch-1')
      store.selectBatch(null)

      expect(store.selectedBatchId).toBe(null)
    })
  })

  describe('Search Filters', () => {
    it('should set search query', () => {
      const store = useUIStore.getState()

      store.setSearchQuery('John Doe')
      expect(store.filters.search?.query).toBe('John Doe')
    })

    it('should set search fields', () => {
      const store = useUIStore.getState()

      store.setSearchFields(['name', 'email'])
      expect(store.filters.search?.fields).toEqual(['name', 'email'])
    })

    it('should initialize search filter if not exists', () => {
      const store = useUIStore.getState()

      // Reset to ensure clean state
      store.reset()

      store.setSearchQuery('test')
      expect(store.filters.search).toBeDefined()
      expect(store.filters.search?.query).toBe('test')
    })
  })

  describe('Batch Filters', () => {
    it('should set batch filter with multiple batches', () => {
      const store = useUIStore.getState()

      store.setBatchFilter(['batch-1', 'batch-2'])
      expect(store.filters.batch?.selected).toEqual(['batch-1', 'batch-2'])
    })

    it('should toggle batch filter', () => {
      const store = useUIStore.getState()

      // Add batch
      store.toggleBatchFilter('batch-1')
      expect(store.filters.batch?.selected).toContain('batch-1')

      // Remove batch
      store.toggleBatchFilter('batch-1')
      expect(store.filters.batch?.selected).not.toContain('batch-1')
    })

    it('should set include unassigned students flag', () => {
      const store = useUIStore.getState()

      store.setIncludeUnassigned(false)
      expect(store.filters.batch?.includeUnassigned).toBe(false)

      store.setIncludeUnassigned(true)
      expect(store.filters.batch?.includeUnassigned).toBe(true)
    })
  })

  describe('Status Filters', () => {
    it('should set status filter', () => {
      const store = useUIStore.getState()
      const statuses: StudentStatus[] = ['ACTIVE', 'INACTIVE']

      store.setStatusFilter(statuses)
      expect(store.filters.status?.selected).toEqual(statuses)
    })

    it('should toggle status filter', () => {
      const store = useUIStore.getState()

      // Add status
      store.toggleStatusFilter('ACTIVE')
      expect(store.filters.status?.selected).toContain('ACTIVE')

      // Remove status
      store.toggleStatusFilter('ACTIVE')
      expect(store.filters.status?.selected).not.toContain('ACTIVE')
    })
  })

  describe('Education Level Filters', () => {
    it('should set education level filter', () => {
      const store = useUIStore.getState()
      const levels: EducationLevel[] = ['ELEMENTARY', 'MIDDLE_SCHOOL']

      store.setEducationLevelFilter(levels)
      expect(store.filters.educationLevel?.selected).toEqual(levels)
    })

    it('should toggle education level filter', () => {
      const store = useUIStore.getState()

      // Add level
      store.toggleEducationLevelFilter('ELEMENTARY')
      expect(store.filters.educationLevel?.selected).toContain('ELEMENTARY')

      // Remove level
      store.toggleEducationLevelFilter('ELEMENTARY')
      expect(store.filters.educationLevel?.selected).not.toContain('ELEMENTARY')
    })
  })

  describe('Grade Level Filters', () => {
    it('should set grade level filter', () => {
      const store = useUIStore.getState()
      const levels: GradeLevel[] = [GradeLevel.GRADE_1, GradeLevel.GRADE_2]

      store.setGradeLevelFilter(levels)
      expect(store.filters.gradeLevel?.selected).toEqual(levels)
    })

    it('should toggle grade level filter', () => {
      const store = useUIStore.getState()

      // Add level
      store.toggleGradeLevelFilter('GRADE_1')
      expect(store.filters.gradeLevel?.selected).toContain('GRADE_1')

      // Remove level
      store.toggleGradeLevelFilter('GRADE_1')
      expect(store.filters.gradeLevel?.selected).not.toContain('GRADE_1')
    })
  })

  describe('Date Range Filters', () => {
    it('should set date range filter', () => {
      const store = useUIStore.getState()
      const from = new Date('2024-01-01')
      const to = new Date('2024-12-31')

      store.setDateRangeFilter(from, to, 'createdAt')

      expect(store.filters.dateRange?.from).toEqual(from)
      expect(store.filters.dateRange?.to).toEqual(to)
      expect(store.filters.dateRange?.field).toBe('createdAt')
    })

    it('should use default field if not provided', () => {
      const store = useUIStore.getState()
      const from = new Date('2024-01-01')
      const to = new Date('2024-12-31')

      store.setDateRangeFilter(from, to)

      expect(store.filters.dateRange?.field).toBe('createdAt')
    })

    it('should clear date range filter', () => {
      const store = useUIStore.getState()

      store.setDateRangeFilter(new Date(), new Date())
      store.clearDateRangeFilter()

      expect(store.filters.dateRange?.from).toBe(null)
      expect(store.filters.dateRange?.to).toBe(null)
    })
  })

  describe('Filter Management', () => {
    it('should detect active filters', () => {
      const store = useUIStore.getState()

      expect(store.hasActiveFilters()).toBe(false)

      store.setSearchQuery('test')
      expect(store.hasActiveFilters()).toBe(true)
    })

    it('should reset all filters', () => {
      const store = useUIStore.getState()

      // Set various filters
      store.setSearchQuery('test')
      store.setBatchFilter(['batch-1'])
      store.setStatusFilter(['ACTIVE'])
      store.selectStudent('student-1')

      // Reset
      store.resetFilters()

      expect(store.filters.search?.query).toBe('')
      expect(store.filters.batch?.selected).toEqual([])
      expect(store.filters.status?.selected).toEqual([])
      expect(store.selectedStudentIds.size).toBe(0)
    })

    it('should count multiple active filters', () => {
      const store = useUIStore.getState()

      store.setSearchQuery('test')
      store.setBatchFilter(['batch-1'])
      store.setStatusFilter(['ACTIVE'])

      expect(store.hasActiveFilters()).toBe(true)
    })
  })

  describe('Dialog States', () => {
    it('should manage create batch dialog state', () => {
      const store = useUIStore.getState()

      expect(store.isCreateBatchDialogOpen).toBe(false)

      store.setCreateBatchDialogOpen(true)
      expect(store.isCreateBatchDialogOpen).toBe(true)

      store.setCreateBatchDialogOpen(false)
      expect(store.isCreateBatchDialogOpen).toBe(false)
    })

    it('should manage assign students dialog state', () => {
      const store = useUIStore.getState()

      expect(store.isAssignStudentsDialogOpen).toBe(false)

      store.setAssignStudentsDialogOpen(true)
      expect(store.isAssignStudentsDialogOpen).toBe(true)

      store.setAssignStudentsDialogOpen(false)
      expect(store.isAssignStudentsDialogOpen).toBe(false)
    })

    it('should manage duplicates expanded state', () => {
      const store = useUIStore.getState()

      expect(store.duplicatesExpanded).toBe(false)

      store.setDuplicatesExpanded(true)
      expect(store.duplicatesExpanded).toBe(true)

      store.setDuplicatesExpanded(false)
      expect(store.duplicatesExpanded).toBe(false)
    })
  })

  describe('Reset Functionality', () => {
    it('should reset all store state', () => {
      const store = useUIStore.getState()

      // Set various states
      store.selectStudent('student-1')
      store.selectBatch('batch-1')
      store.setSearchQuery('test')
      store.setCreateBatchDialogOpen(true)
      store.setAssignStudentsDialogOpen(true)
      store.setDuplicatesExpanded(true)

      // Reset
      store.reset()

      // Verify all states are reset
      expect(store.selectedStudentIds.size).toBe(0)
      expect(store.selectedBatchId).toBe(null)
      expect(store.filters.search?.query).toBe('')
      expect(store.isCreateBatchDialogOpen).toBe(false)
      expect(store.isAssignStudentsDialogOpen).toBe(false)
      expect(store.duplicatesExpanded).toBe(false)
    })
  })

  describe('Store Selectors', () => {
    it('should have working selector hooks', () => {
      const store = useUIStore.getState()

      store.selectStudent('student-1')
      store.selectBatch('batch-1')
      store.setSearchQuery('test')

      // Test selectors exist (they are used in components)
      expect(typeof useUIStore.getState().selectedStudentIds).toBe('object')
      expect(typeof useUIStore.getState().selectedBatchId).toBe('string')
      expect(typeof useUIStore.getState().filters).toBe('object')
    })
  })
})
