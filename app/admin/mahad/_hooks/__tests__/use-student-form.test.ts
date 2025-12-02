import {
  GradeLevel,
  GraduationStatus,
  PaymentFrequency,
  StudentBillingType,
} from '@prisma/client'
import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import type { BatchStudentData } from '@/lib/types/batch'
import { StudentStatus } from '@/lib/types/student'

import { useStudentForm } from '../use-student-form'

const createMockStudent = (
  overrides: Partial<BatchStudentData> = {}
): BatchStudentData => ({
  id: 'test-id',
  name: 'Test Student',
  email: 'test@example.com',
  phone: '1234567890',
  dateOfBirth: new Date('2000-01-01'),
  gradeLevel: GradeLevel.GRADE_5,
  schoolName: 'Test School',
  graduationStatus: GraduationStatus.NON_GRADUATE,
  paymentFrequency: PaymentFrequency.MONTHLY,
  billingType: StudentBillingType.FULL_TIME,
  paymentNotes: 'Test notes',
  status: StudentStatus.ENROLLED,
  batchId: 'batch-123',
  createdAt: new Date(),
  updatedAt: new Date(),
  batch: { id: 'batch-123', name: 'Batch 1', startDate: null, endDate: null },
  subscription: null,
  siblingCount: 0,
  ...overrides,
})

describe('useStudentForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should initialize form data from student', () => {
      const student = createMockStudent()
      const { result } = renderHook(() => useStudentForm(student, true))

      expect(result.current.formData.name).toBe('Test Student')
      expect(result.current.formData.email).toBe('test@example.com')
      expect(result.current.formData.phone).toBe('1234567890')
      expect(result.current.formData.gradeLevel).toBe(GradeLevel.GRADE_5)
    })

    it('should handle null values with defaults', () => {
      const student = createMockStudent({
        email: null,
        phone: null,
        gradeLevel: null,
      })
      const { result } = renderHook(() => useStudentForm(student, true))

      expect(result.current.formData.email).toBe('')
      expect(result.current.formData.phone).toBe('')
      expect(result.current.formData.gradeLevel).toBe('none')
    })
  })

  describe('updateField', () => {
    it('should update a single field', () => {
      const student = createMockStudent()
      const { result } = renderHook(() => useStudentForm(student, true))

      act(() => {
        result.current.updateField('name', 'Updated Name')
      })

      expect(result.current.formData.name).toBe('Updated Name')
    })

    it('should preserve other fields when updating one', () => {
      const student = createMockStudent()
      const { result } = renderHook(() => useStudentForm(student, true))

      act(() => {
        result.current.updateField('name', 'Updated Name')
      })

      expect(result.current.formData.email).toBe('test@example.com')
      expect(result.current.formData.phone).toBe('1234567890')
    })

    it('should update gradeLevel', () => {
      const student = createMockStudent()
      const { result } = renderHook(() => useStudentForm(student, true))

      act(() => {
        result.current.updateField('gradeLevel', GradeLevel.GRADE_6)
      })

      expect(result.current.formData.gradeLevel).toBe(GradeLevel.GRADE_6)
    })
  })

  describe('reset', () => {
    it('should reset form to original student data', () => {
      const student = createMockStudent()
      const { result } = renderHook(() => useStudentForm(student, true))

      act(() => {
        result.current.updateField('name', 'Changed Name')
        result.current.updateField('email', 'changed@email.com')
      })

      expect(result.current.formData.name).toBe('Changed Name')

      act(() => {
        result.current.reset()
      })

      expect(result.current.formData.name).toBe('Test Student')
      expect(result.current.formData.email).toBe('test@example.com')
    })
  })

  describe('toPayload', () => {
    it('should convert form data to API payload', () => {
      const student = createMockStudent()
      const { result } = renderHook(() => useStudentForm(student, true))

      const payload = result.current.toPayload()

      expect(payload.name).toBe('Test Student')
      expect(payload.email).toBe('test@example.com')
      expect(payload.gradeLevel).toBe(GradeLevel.GRADE_5)
    })

    it('should convert "none" values to null in payload', () => {
      const student = createMockStudent({
        gradeLevel: null,
        graduationStatus: null,
      })
      const { result } = renderHook(() => useStudentForm(student, true))

      const payload = result.current.toPayload()

      expect(payload.gradeLevel).toBeNull()
      expect(payload.graduationStatus).toBeNull()
    })
  })

  describe('isValid', () => {
    it('should return true for valid form data', () => {
      const student = createMockStudent()
      const { result } = renderHook(() => useStudentForm(student, true))

      expect(result.current.isValid).toBe(true)
    })

    it('should return false when name is empty', () => {
      const student = createMockStudent({ name: '' })
      const { result } = renderHook(() => useStudentForm(student, true))

      expect(result.current.isValid).toBe(false)
    })

    it('should return false for invalid email', () => {
      const student = createMockStudent()
      const { result } = renderHook(() => useStudentForm(student, true))

      act(() => {
        result.current.updateField('email', 'invalid-email')
      })

      expect(result.current.isValid).toBe(false)
    })

    it('should return false for invalid phone', () => {
      const student = createMockStudent()
      const { result } = renderHook(() => useStudentForm(student, true))

      act(() => {
        result.current.updateField('phone', '123')
      })

      expect(result.current.isValid).toBe(false)
    })
  })

  describe('hasChanges', () => {
    it('should return false when no changes made', () => {
      const student = createMockStudent()
      const { result } = renderHook(() => useStudentForm(student, true))

      expect(result.current.hasChanges).toBe(false)
    })

    it('should return true when name changed', () => {
      const student = createMockStudent()
      const { result } = renderHook(() => useStudentForm(student, true))

      act(() => {
        result.current.updateField('name', 'Different Name')
      })

      expect(result.current.hasChanges).toBe(true)
    })

    it('should return true when email changed', () => {
      const student = createMockStudent()
      const { result } = renderHook(() => useStudentForm(student, true))

      act(() => {
        result.current.updateField('email', 'different@email.com')
      })

      expect(result.current.hasChanges).toBe(true)
    })

    it('should return false after reset', () => {
      const student = createMockStudent()
      const { result } = renderHook(() => useStudentForm(student, true))

      act(() => {
        result.current.updateField('name', 'Changed')
      })

      expect(result.current.hasChanges).toBe(true)

      act(() => {
        result.current.reset()
      })

      expect(result.current.hasChanges).toBe(false)
    })
  })

  describe('student prop changes', () => {
    it('should reset form when student changes and open is true', () => {
      const student1 = createMockStudent({ name: 'Student 1' })
      const student2 = createMockStudent({ name: 'Student 2' })

      const { result, rerender } = renderHook(
        ({ student, open }) => useStudentForm(student, open),
        { initialProps: { student: student1, open: true } }
      )

      expect(result.current.formData.name).toBe('Student 1')

      rerender({ student: student2, open: true })

      expect(result.current.formData.name).toBe('Student 2')
    })

    it('should not reset when open is false', () => {
      const student1 = createMockStudent({ name: 'Student 1' })
      const student2 = createMockStudent({ name: 'Student 2' })

      const { result, rerender } = renderHook(
        ({ student, open }) => useStudentForm(student, open),
        { initialProps: { student: student1, open: false } }
      )

      act(() => {
        result.current.updateField('name', 'Edited Name')
      })

      rerender({ student: student2, open: false })

      expect(result.current.formData.name).toBe('Edited Name')
    })
  })
})
