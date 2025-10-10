/**
 * Filter Utilities Tests
 *
 * Tests for client-side filtering functions that filter students based on UI store filters.
 */

import { EducationLevel, GradeLevel } from '@prisma/client'
import { describe, it, expect } from 'vitest'

import {
  filterStudents,
  getBatchStudentCount,
  getUnassignedStudentsCount,
  getSelectedStudentsData,
  getFilterSummary,
  isFilterActive,
  countActiveFilters,
} from '@/app/batches/store/filter-utils'
import { StudentFilters } from '@/app/batches/store/ui-store'
import { BatchStudentData, StudentStatus } from '@/lib/types/batch'

// Mock student data for testing
const createMockStudent = (
  overrides: Partial<BatchStudentData> = {}
): BatchStudentData => ({
  id: 'student-1',
  name: 'John Doe',
  email: 'john@example.com',
  phone: '123-456-7890',
  status: 'ACTIVE',
  educationLevel: 'ELEMENTARY',
  gradeLevel: 'GRADE_1',
  dateOfBirth: new Date('2010-01-01'),
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  batch: {
    id: 'batch-1',
    name: 'Spring 2024',
    startDate: new Date('2024-01-15'),
    endDate: null,
  },
  siblingGroup: null,
  address: null,
  parentName: null,
  parentEmail: null,
  parentPhone: null,
  emergencyContact: null,
  emergencyPhone: null,
  medicalNotes: null,
  dietaryRestrictions: null,
  notes: null,
  batchId: 'batch-1',
  siblingGroupId: null,
  ...overrides,
})

describe('Filter Utilities', () => {
  describe('filterStudents', () => {
    it('should filter students by search query (name)', () => {
      const students: BatchStudentData[] = [
        createMockStudent({ id: 'student-1', name: 'John Doe' }),
        createMockStudent({ id: 'student-2', name: 'Jane Smith' }),
        createMockStudent({ id: 'student-3', name: 'Bob Johnson' }),
      ]

      const filters: StudentFilters = {
        search: {
          query: 'john',
          fields: ['name', 'email', 'phone'],
        },
      }

      const result = filterStudents(students, filters)

      expect(result).toHaveLength(2) // John Doe and Bob Johnson
      expect(result.map((s) => s.id)).toContain('student-1')
      expect(result.map((s) => s.id)).toContain('student-3')
    })

    it('should filter students by search query (email)', () => {
      const students: BatchStudentData[] = [
        createMockStudent({ id: 'student-1', email: 'john@example.com' }),
        createMockStudent({ id: 'student-2', email: 'jane@test.com' }),
      ]

      const filters: StudentFilters = {
        search: {
          query: 'example',
          fields: ['name', 'email', 'phone'],
        },
      }

      const result = filterStudents(students, filters)

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('student-1')
    })

    it('should filter students by batch', () => {
      const students: BatchStudentData[] = [
        createMockStudent({
          id: 'student-1',
          batchId: 'batch-1',
          batch: { id: 'batch-1', name: 'Batch 1', startDate: null, endDate: null },
        }),
        createMockStudent({
          id: 'student-2',
          batchId: 'batch-2',
          batch: { id: 'batch-2', name: 'Batch 2', startDate: null, endDate: null },
        }),
        createMockStudent({
          id: 'student-3',
          batchId: null,
          batch: null,
        }),
      ]

      const filters: StudentFilters = {
        batch: {
          selected: ['batch-1'],
          includeUnassigned: false,
        },
      }

      const result = filterStudents(students, filters)

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('student-1')
    })

    it('should include unassigned students when flag is set', () => {
      const students: BatchStudentData[] = [
        createMockStudent({
          id: 'student-1',
          batchId: 'batch-1',
          batch: { id: 'batch-1', name: 'Batch 1', startDate: null, endDate: null },
        }),
        createMockStudent({
          id: 'student-2',
          batchId: null,
          batch: null,
        }),
      ]

      const filters: StudentFilters = {
        batch: {
          selected: ['batch-1'],
          includeUnassigned: true,
        },
      }

      const result = filterStudents(students, filters)

      expect(result).toHaveLength(2)
    })

    it('should filter students by status', () => {
      const students: BatchStudentData[] = [
        createMockStudent({ id: 'student-1', status: 'ACTIVE' }),
        createMockStudent({ id: 'student-2', status: 'INACTIVE' }),
        createMockStudent({ id: 'student-3', status: 'ACTIVE' }),
      ]

      const filters: StudentFilters = {
        status: {
          selected: ['ACTIVE' as StudentStatus],
        },
      }

      const result = filterStudents(students, filters)

      expect(result).toHaveLength(2)
      expect(result.map((s) => s.id)).toContain('student-1')
      expect(result.map((s) => s.id)).toContain('student-3')
    })

    it('should filter students by education level', () => {
      const students: BatchStudentData[] = [
        createMockStudent({ id: 'student-1', educationLevel: 'ELEMENTARY' }),
        createMockStudent({ id: 'student-2', educationLevel: 'MIDDLE_SCHOOL' }),
        createMockStudent({ id: 'student-3', educationLevel: 'ELEMENTARY' }),
      ]

      const filters: StudentFilters = {
        educationLevel: {
          selected: ['ELEMENTARY' as EducationLevel],
        },
      }

      const result = filterStudents(students, filters)

      expect(result).toHaveLength(2)
    })

    it('should filter students by grade level', () => {
      const students: BatchStudentData[] = [
        createMockStudent({ id: 'student-1', gradeLevel: 'GRADE_1' }),
        createMockStudent({ id: 'student-2', gradeLevel: 'GRADE_2' }),
        createMockStudent({ id: 'student-3', gradeLevel: 'GRADE_1' }),
      ]

      const filters: StudentFilters = {
        gradeLevel: {
          selected: ['GRADE_1' as GradeLevel],
        },
      }

      const result = filterStudents(students, filters)

      expect(result).toHaveLength(2)
    })

    it('should filter students by date range', () => {
      const students: BatchStudentData[] = [
        createMockStudent({
          id: 'student-1',
          createdAt: new Date('2024-01-01'),
        }),
        createMockStudent({
          id: 'student-2',
          createdAt: new Date('2024-06-15'),
        }),
        createMockStudent({
          id: 'student-3',
          createdAt: new Date('2024-12-31'),
        }),
      ]

      const filters: StudentFilters = {
        dateRange: {
          from: new Date('2024-06-01'),
          to: new Date('2024-12-31'),
          field: 'createdAt',
        },
      }

      const result = filterStudents(students, filters)

      expect(result).toHaveLength(2)
      expect(result.map((s) => s.id)).toContain('student-2')
      expect(result.map((s) => s.id)).toContain('student-3')
    })

    it('should combine multiple filters', () => {
      const students: BatchStudentData[] = [
        createMockStudent({
          id: 'student-1',
          name: 'John Doe',
          status: 'ACTIVE',
          educationLevel: 'ELEMENTARY',
        }),
        createMockStudent({
          id: 'student-2',
          name: 'John Smith',
          status: 'INACTIVE',
          educationLevel: 'ELEMENTARY',
        }),
        createMockStudent({
          id: 'student-3',
          name: 'Jane Doe',
          status: 'ACTIVE',
          educationLevel: 'MIDDLE_SCHOOL',
        }),
      ]

      const filters: StudentFilters = {
        search: {
          query: 'john',
          fields: ['name'],
        },
        status: {
          selected: ['ACTIVE' as StudentStatus],
        },
        educationLevel: {
          selected: ['ELEMENTARY' as EducationLevel],
        },
      }

      const result = filterStudents(students, filters)

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('student-1')
    })

    it('should return all students when no filters are applied', () => {
      const students: BatchStudentData[] = [
        createMockStudent({ id: 'student-1' }),
        createMockStudent({ id: 'student-2' }),
      ]

      const filters: StudentFilters = {}

      const result = filterStudents(students, filters)

      expect(result).toHaveLength(2)
    })
  })

  describe('getBatchStudentCount', () => {
    it('should count students in a specific batch', () => {
      const students: BatchStudentData[] = [
        createMockStudent({
          id: 'student-1',
          batchId: 'batch-1',
          batch: { id: 'batch-1', name: 'Batch 1', startDate: null, endDate: null },
        }),
        createMockStudent({
          id: 'student-2',
          batchId: 'batch-1',
          batch: { id: 'batch-1', name: 'Batch 1', startDate: null, endDate: null },
        }),
        createMockStudent({
          id: 'student-3',
          batchId: 'batch-2',
          batch: { id: 'batch-2', name: 'Batch 2', startDate: null, endDate: null },
        }),
      ]

      const count = getBatchStudentCount(students, 'batch-1')

      expect(count).toBe(2)
    })

    it('should return 0 for batch with no students', () => {
      const students: BatchStudentData[] = [
        createMockStudent({
          id: 'student-1',
          batchId: 'batch-1',
          batch: { id: 'batch-1', name: 'Batch 1', startDate: null, endDate: null },
        }),
      ]

      const count = getBatchStudentCount(students, 'batch-2')

      expect(count).toBe(0)
    })
  })

  describe('getUnassignedStudentsCount', () => {
    it('should count unassigned students', () => {
      const students: BatchStudentData[] = [
        createMockStudent({
          id: 'student-1',
          batchId: 'batch-1',
          batch: { id: 'batch-1', name: 'Batch 1', startDate: null, endDate: null },
        }),
        createMockStudent({
          id: 'student-2',
          batchId: null,
          batch: null,
        }),
        createMockStudent({
          id: 'student-3',
          batchId: null,
          batch: null,
        }),
      ]

      const count = getUnassignedStudentsCount(students)

      expect(count).toBe(2)
    })

    it('should return 0 when all students are assigned', () => {
      const students: BatchStudentData[] = [
        createMockStudent({
          id: 'student-1',
          batchId: 'batch-1',
          batch: { id: 'batch-1', name: 'Batch 1', startDate: null, endDate: null },
        }),
      ]

      const count = getUnassignedStudentsCount(students)

      expect(count).toBe(0)
    })
  })

  describe('getSelectedStudentsData', () => {
    it('should return data for selected students', () => {
      const students: BatchStudentData[] = [
        createMockStudent({ id: 'student-1' }),
        createMockStudent({ id: 'student-2' }),
        createMockStudent({ id: 'student-3' }),
      ]

      const selectedIds = new Set(['student-1', 'student-3'])

      const result = getSelectedStudentsData(students, selectedIds)

      expect(result).toHaveLength(2)
      expect(result.map((s) => s.id)).toContain('student-1')
      expect(result.map((s) => s.id)).toContain('student-3')
    })

    it('should return empty array when no students are selected', () => {
      const students: BatchStudentData[] = [
        createMockStudent({ id: 'student-1' }),
      ]

      const selectedIds = new Set<string>()

      const result = getSelectedStudentsData(students, selectedIds)

      expect(result).toHaveLength(0)
    })
  })

  describe('getFilterSummary', () => {
    it('should generate summary for search filter', () => {
      const filters: StudentFilters = {
        search: {
          query: 'john',
          fields: ['name'],
        },
      }

      const summary = getFilterSummary(filters)

      expect(summary).toContain('Search: "john"')
    })

    it('should generate summary for batch filter', () => {
      const filters: StudentFilters = {
        batch: {
          selected: ['batch-1', 'batch-2'],
          includeUnassigned: true,
        },
      }

      const summary = getFilterSummary(filters)

      expect(summary).toContain('Batches: 2 selected')
    })

    it('should generate summary for status filter', () => {
      const filters: StudentFilters = {
        status: {
          selected: ['ACTIVE' as StudentStatus, 'INACTIVE' as StudentStatus],
        },
      }

      const summary = getFilterSummary(filters)

      expect(summary).toContain('Status: ACTIVE, INACTIVE')
    })

    it('should generate summary for date range filter', () => {
      const filters: StudentFilters = {
        dateRange: {
          from: new Date('2024-01-01'),
          to: new Date('2024-12-31'),
          field: 'createdAt',
        },
      }

      const summary = getFilterSummary(filters)

      expect(summary).toContain('Date range applied')
    })

    it('should return empty array when no filters are active', () => {
      const filters: StudentFilters = {}

      const summary = getFilterSummary(filters)

      expect(summary).toHaveLength(0)
    })
  })

  describe('isFilterActive', () => {
    it('should detect active search filter', () => {
      const filters: StudentFilters = {
        search: {
          query: 'test',
          fields: ['name'],
        },
      }

      expect(isFilterActive(filters, 'search')).toBe(true)
    })

    it('should detect active batch filter', () => {
      const filters: StudentFilters = {
        batch: {
          selected: ['batch-1'],
          includeUnassigned: true,
        },
      }

      expect(isFilterActive(filters, 'batch')).toBe(true)
    })

    it('should detect active date range filter', () => {
      const filters: StudentFilters = {
        dateRange: {
          from: new Date('2024-01-01'),
          to: null,
          field: 'createdAt',
        },
      }

      expect(isFilterActive(filters, 'dateRange')).toBe(true)
    })

    it('should return false for inactive filter', () => {
      const filters: StudentFilters = {
        search: {
          query: '',
          fields: ['name'],
        },
      }

      expect(isFilterActive(filters, 'search')).toBe(false)
    })
  })

  describe('countActiveFilters', () => {
    it('should count multiple active filters', () => {
      const filters: StudentFilters = {
        search: {
          query: 'test',
          fields: ['name'],
        },
        batch: {
          selected: ['batch-1'],
          includeUnassigned: true,
        },
        status: {
          selected: ['ACTIVE' as StudentStatus],
        },
      }

      const count = countActiveFilters(filters)

      expect(count).toBe(3)
    })

    it('should return 0 when no filters are active', () => {
      const filters: StudentFilters = {}

      const count = countActiveFilters(filters)

      expect(count).toBe(0)
    })

    it('should not count empty filters', () => {
      const filters: StudentFilters = {
        search: {
          query: '',
          fields: ['name'],
        },
        batch: {
          selected: [],
          includeUnassigned: true,
        },
      }

      const count = countActiveFilters(filters)

      expect(count).toBe(0)
    })
  })
})
