import {
  GradeLevel,
  GraduationStatus,
  PaymentFrequency,
  StudentBillingType,
} from '@prisma/client'
import { describe, expect, it } from 'vitest'


import type { BatchStudentData } from '@/lib/types/batch'
import { StudentStatus } from '@/lib/types/student'

import { FORM_DEFAULTS } from '../../_types'
import {
  convertFormDataToPayload,
  getDefaultFormData,
  hasFormChanges,
  isFormValid,
} from '../student-form-utils'

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

describe('student-form-utils', () => {
  describe('getDefaultFormData', () => {
    it('should convert student data to form data', () => {
      const student = createMockStudent()
      const formData = getDefaultFormData(student)

      expect(formData.name).toBe('Test Student')
      expect(formData.email).toBe('test@example.com')
      expect(formData.phone).toBe('1234567890')
      expect(formData.gradeLevel).toBe(GradeLevel.GRADE_5)
      expect(formData.schoolName).toBe('Test School')
      expect(formData.batchId).toBe('batch-123')
    })

    it('should handle null/undefined values with defaults', () => {
      const student = createMockStudent({
        email: null,
        phone: null,
        gradeLevel: null,
        schoolName: null,
        graduationStatus: null,
        paymentFrequency: null,
        billingType: null,
        paymentNotes: null,
        batchId: null,
      })
      const formData = getDefaultFormData(student)

      expect(formData.email).toBe(FORM_DEFAULTS.EMPTY)
      expect(formData.phone).toBe(FORM_DEFAULTS.EMPTY)
      expect(formData.gradeLevel).toBe(FORM_DEFAULTS.NONE)
      expect(formData.schoolName).toBe(FORM_DEFAULTS.EMPTY)
      expect(formData.graduationStatus).toBe(FORM_DEFAULTS.NONE)
      expect(formData.paymentFrequency).toBe(FORM_DEFAULTS.NONE)
      expect(formData.billingType).toBe(FORM_DEFAULTS.NONE)
      expect(formData.paymentNotes).toBe(FORM_DEFAULTS.EMPTY)
      expect(formData.batchId).toBe(FORM_DEFAULTS.NONE)
    })
  })

  describe('convertFormDataToPayload', () => {
    it('should convert form data to API payload', () => {
      const formData = {
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
        batchId: 'batch-123',
      }

      const payload = convertFormDataToPayload(formData)

      expect(payload.name).toBe('Test Student')
      expect(payload.email).toBe('test@example.com')
      expect(payload.gradeLevel).toBe(GradeLevel.GRADE_5)
      expect(payload.batchId).toBe('batch-123')
    })

    it('should convert "none" placeholder to null', () => {
      const formData = {
        name: 'Test Student',
        email: '',
        phone: '',
        dateOfBirth: null,
        gradeLevel: FORM_DEFAULTS.NONE,
        schoolName: '',
        graduationStatus: FORM_DEFAULTS.NONE,
        paymentFrequency: FORM_DEFAULTS.NONE,
        billingType: FORM_DEFAULTS.NONE,
        paymentNotes: '',
        batchId: FORM_DEFAULTS.NONE,
      }

      const payload = convertFormDataToPayload(formData)

      expect(payload.email).toBeNull()
      expect(payload.phone).toBeNull()
      expect(payload.gradeLevel).toBeNull()
      expect(payload.graduationStatus).toBeNull()
      expect(payload.paymentFrequency).toBeNull()
      expect(payload.billingType).toBeNull()
      expect(payload.batchId).toBeNull()
    })

    it('should convert empty strings to null', () => {
      const formData = {
        name: 'Test Student',
        email: '',
        phone: '',
        dateOfBirth: null,
        gradeLevel: FORM_DEFAULTS.NONE,
        schoolName: '',
        graduationStatus: FORM_DEFAULTS.NONE,
        paymentFrequency: FORM_DEFAULTS.NONE,
        billingType: FORM_DEFAULTS.NONE,
        paymentNotes: '',
        batchId: FORM_DEFAULTS.NONE,
      }

      const payload = convertFormDataToPayload(formData)

      expect(payload.email).toBeNull()
      expect(payload.phone).toBeNull()
      expect(payload.schoolName).toBeNull()
      expect(payload.paymentNotes).toBeNull()
    })
  })

  describe('isFormValid', () => {
    it('should return true for valid form data', () => {
      const formData = {
        name: 'Test Student',
        email: 'test@example.com',
        phone: '1234567890',
        dateOfBirth: null,
        gradeLevel: FORM_DEFAULTS.NONE,
        schoolName: '',
        graduationStatus: FORM_DEFAULTS.NONE,
        paymentFrequency: FORM_DEFAULTS.NONE,
        billingType: FORM_DEFAULTS.NONE,
        paymentNotes: '',
        batchId: FORM_DEFAULTS.NONE,
      }

      expect(isFormValid(formData)).toBe(true)
    })

    it('should return false if name is empty', () => {
      const formData = {
        name: '',
        email: 'test@example.com',
        phone: '1234567890',
        dateOfBirth: null,
        gradeLevel: FORM_DEFAULTS.NONE,
        schoolName: '',
        graduationStatus: FORM_DEFAULTS.NONE,
        paymentFrequency: FORM_DEFAULTS.NONE,
        billingType: FORM_DEFAULTS.NONE,
        paymentNotes: '',
        batchId: FORM_DEFAULTS.NONE,
      }

      expect(isFormValid(formData)).toBe(false)
    })

    it('should return false if name is only whitespace', () => {
      const formData = {
        name: '   ',
        email: '',
        phone: '',
        dateOfBirth: null,
        gradeLevel: FORM_DEFAULTS.NONE,
        schoolName: '',
        graduationStatus: FORM_DEFAULTS.NONE,
        paymentFrequency: FORM_DEFAULTS.NONE,
        billingType: FORM_DEFAULTS.NONE,
        paymentNotes: '',
        batchId: FORM_DEFAULTS.NONE,
      }

      expect(isFormValid(formData)).toBe(false)
    })

    it('should return false for invalid email format', () => {
      const formData = {
        name: 'Test Student',
        email: 'invalid-email',
        phone: '',
        dateOfBirth: null,
        gradeLevel: FORM_DEFAULTS.NONE,
        schoolName: '',
        graduationStatus: FORM_DEFAULTS.NONE,
        paymentFrequency: FORM_DEFAULTS.NONE,
        billingType: FORM_DEFAULTS.NONE,
        paymentNotes: '',
        batchId: FORM_DEFAULTS.NONE,
      }

      expect(isFormValid(formData)).toBe(false)
    })

    it('should return true for empty email (optional field)', () => {
      const formData = {
        name: 'Test Student',
        email: '',
        phone: '',
        dateOfBirth: null,
        gradeLevel: FORM_DEFAULTS.NONE,
        schoolName: '',
        graduationStatus: FORM_DEFAULTS.NONE,
        paymentFrequency: FORM_DEFAULTS.NONE,
        billingType: FORM_DEFAULTS.NONE,
        paymentNotes: '',
        batchId: FORM_DEFAULTS.NONE,
      }

      expect(isFormValid(formData)).toBe(true)
    })

    it('should return false for invalid phone (too short)', () => {
      const formData = {
        name: 'Test Student',
        email: '',
        phone: '123',
        dateOfBirth: null,
        gradeLevel: FORM_DEFAULTS.NONE,
        schoolName: '',
        graduationStatus: FORM_DEFAULTS.NONE,
        paymentFrequency: FORM_DEFAULTS.NONE,
        billingType: FORM_DEFAULTS.NONE,
        paymentNotes: '',
        batchId: FORM_DEFAULTS.NONE,
      }

      expect(isFormValid(formData)).toBe(false)
    })

    it('should return true for valid phone with formatting', () => {
      const formData = {
        name: 'Test Student',
        email: '',
        phone: '(123) 456-7890',
        dateOfBirth: null,
        gradeLevel: FORM_DEFAULTS.NONE,
        schoolName: '',
        graduationStatus: FORM_DEFAULTS.NONE,
        paymentFrequency: FORM_DEFAULTS.NONE,
        billingType: FORM_DEFAULTS.NONE,
        paymentNotes: '',
        batchId: FORM_DEFAULTS.NONE,
      }

      expect(isFormValid(formData)).toBe(true)
    })
  })

  describe('hasFormChanges', () => {
    it('should return false when no changes', () => {
      const student = createMockStudent()
      const formData = getDefaultFormData(student)

      expect(hasFormChanges(formData, student)).toBe(false)
    })

    it('should return true when name changed', () => {
      const student = createMockStudent()
      const formData = getDefaultFormData(student)
      formData.name = 'Updated Name'

      expect(hasFormChanges(formData, student)).toBe(true)
    })

    it('should return true when email changed', () => {
      const student = createMockStudent()
      const formData = getDefaultFormData(student)
      formData.email = 'new@example.com'

      expect(hasFormChanges(formData, student)).toBe(true)
    })

    it('should return true when batchId changed', () => {
      const student = createMockStudent()
      const formData = getDefaultFormData(student)
      formData.batchId = 'new-batch-id'

      expect(hasFormChanges(formData, student)).toBe(true)
    })

    it('should return true when dateOfBirth changed', () => {
      const student = createMockStudent()
      const formData = getDefaultFormData(student)
      formData.dateOfBirth = new Date('2001-01-01')

      expect(hasFormChanges(formData, student)).toBe(true)
    })

    it('should return true when gradeLevel changed', () => {
      const student = createMockStudent()
      const formData = getDefaultFormData(student)
      formData.gradeLevel = GradeLevel.GRADE_6

      expect(hasFormChanges(formData, student)).toBe(true)
    })

    it('should return true when billingType changed', () => {
      const student = createMockStudent()
      const formData = getDefaultFormData(student)
      formData.billingType = StudentBillingType.PART_TIME

      expect(hasFormChanges(formData, student)).toBe(true)
    })
  })
})
