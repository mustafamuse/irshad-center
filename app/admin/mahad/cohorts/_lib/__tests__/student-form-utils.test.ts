import { EducationLevel, GradeLevel } from '@prisma/client'
import { describe, expect, it } from 'vitest'

import type { BatchStudentData } from '@/lib/types/batch'

import { FORM_DEFAULTS, type StudentFormData } from '../../types/student-form'
import {
  convertFormDataToPayload,
  formatEducationLevel,
  formatGradeLevel,
  getDefaultFormData,
  hasFormChanges,
  isFormValid,
} from '../student-form-utils'

describe('student-form-utils', () => {
  // Mock student data for testing
  const mockStudent: BatchStudentData = {
    id: 'student-1',
    name: 'John Doe',
    email: 'john@example.com',
    phone: '1234567890',
    dateOfBirth: new Date('2010-01-15'),
    educationLevel: EducationLevel.MIDDLE_SCHOOL,
    gradeLevel: GradeLevel.GRADE_7,
    schoolName: 'Test School',
    monthlyRate: 150,
    customRate: false,
    batchId: 'batch-1',
    status: 'registered',
    createdAt: new Date(),
    updatedAt: new Date(),
    // Additional fields from full Student model
    parentEmail: null,
    subscriptionStatus: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    stripePaymentMethodId: null,
    stripeSubscriptionItemId: null,
    lastPaymentDate: null,
    lastPaymentAmount: null,
    lastPaymentStatus: null,
    nextPaymentDue: null,
    subscriptionStartDate: null,
    subscriptionEndDate: null,
    subscriptionCancelAtPeriodEnd: false,
    subscriptionTrialEnd: null,
    subscriptionCurrentPeriodStart: null,
    subscriptionCurrentPeriodEnd: null,
    stripePaymentIntentId: null,
    stripePriceId: null,
    stripeInvoiceId: null,
    stripeProductId: null,
    subscriptionPausedAt: null,
    subscriptionPausedReason: null,
    paymentFailureCount: 0,
    lastPaymentFailureDate: null,
    lastPaymentFailureReason: null,
    discountAmount: null,
    discountPercentage: null,
    discountEndDate: null,
    discountReason: null,
    notes: null,
    internalNotes: null,
    graduationYear: null,
    enrollmentDate: null,
    withdrawalDate: null,
    withdrawalReason: null,
    referralSource: null,
    emergencyContactName: null,
    emergencyContactPhone: null,
    emergencyContactRelation: null,
    medicalConditions: null,
    allergies: null,
    medications: null,
    dietaryRestrictions: null,
    specialNeeds: null,
    photoConsent: false,
    mediaConsent: false,
    transportationMethod: null,
    pickupAuthorization: null,
    addressLine1: null,
    addressLine2: null,
    city: null,
    state: null,
    zipCode: null,
    country: null,
    preferredContactMethod: null,
    preferredLanguage: null,
    ethnicBackground: null,
    hasScholarship: false,
    scholarshipAmount: null,
    scholarshipEndDate: null,
    attendanceRate: null,
    behavioralNotes: null,
    academicNotes: null,
    parentOccupation: null,
    householdIncome: null,
    numberOfSiblings: null,
    birthOrder: null,
    primaryGuardian: null,
    secondaryGuardian: null,
    previousSchool: null,
    reasonForJoining: null,
    goals: null,
    achievements: null,
    qrCodeData: null,
    studentCode: null,
    gender: null,
    primaryContactName: null,
    primaryContactEmail: null,
    primaryContactPhone: null,
    secondaryContactName: null,
    secondaryContactEmail: null,
    secondaryContactPhone: null,
    highSchoolGraduated: false,
    highSchoolGradYear: null,
    interestedInPostSecondary: false,
    plannedCollege: null,
    plannedMajor: null,
    Batch: {
      id: 'batch-1',
      name: 'Test Batch',
      startDate: new Date(),
      endDate: null,
    },
    Sibling: null,
  } as unknown as BatchStudentData

  describe('getDefaultFormData', () => {
    it('should convert student data to form data with all fields', () => {
      const formData = getDefaultFormData(mockStudent)

      expect(formData).toEqual({
        name: 'John Doe',
        email: 'john@example.com',
        phone: '1234567890',
        dateOfBirth: mockStudent.dateOfBirth,
        educationLevel: EducationLevel.MIDDLE_SCHOOL,
        gradeLevel: GradeLevel.GRADE_7,
        schoolName: 'Test School',
        monthlyRate: 150,
        customRate: false,
        batchId: 'batch-1',
      })
    })

    it('should use EMPTY default for null string fields', () => {
      const studentWithNulls: BatchStudentData = {
        ...mockStudent,
        email: null,
        phone: null,
        schoolName: null,
      }

      const formData = getDefaultFormData(studentWithNulls)

      expect(formData.email).toBe(FORM_DEFAULTS.EMPTY)
      expect(formData.phone).toBe(FORM_DEFAULTS.EMPTY)
      expect(formData.schoolName).toBe(FORM_DEFAULTS.EMPTY)
    })

    it('should use NONE default for null enum fields', () => {
      const studentWithNulls: BatchStudentData = {
        ...mockStudent,
        educationLevel: null,
        gradeLevel: null,
        batchId: null,
      }

      const formData = getDefaultFormData(studentWithNulls)

      expect(formData.educationLevel).toBe(FORM_DEFAULTS.NONE)
      expect(formData.gradeLevel).toBe(FORM_DEFAULTS.NONE)
      expect(formData.batchId).toBe(FORM_DEFAULTS.NONE)
    })
  })

  describe('convertFormDataToPayload', () => {
    it('should convert complete form data to payload', () => {
      const formData: StudentFormData = {
        name: 'Jane Smith',
        email: 'jane@example.com',
        phone: '9876543210',
        dateOfBirth: new Date('2012-05-20'),
        educationLevel: EducationLevel.HIGH_SCHOOL,
        gradeLevel: GradeLevel.GRADE_9,
        schoolName: 'High School',
        monthlyRate: 200,
        customRate: true,
        batchId: 'batch-2',
      }

      const payload = convertFormDataToPayload(formData)

      expect(payload).toEqual({
        name: 'Jane Smith',
        email: 'jane@example.com',
        phone: '9876543210',
        dateOfBirth: formData.dateOfBirth,
        educationLevel: EducationLevel.HIGH_SCHOOL,
        gradeLevel: GradeLevel.GRADE_9,
        schoolName: 'High School',
        monthlyRate: 200,
        customRate: true,
        batchId: 'batch-2',
      })
    })

    it('should convert empty strings to null', () => {
      const formData: StudentFormData = {
        name: 'John Doe',
        email: '',
        phone: '',
        dateOfBirth: null,
        educationLevel: '',
        gradeLevel: '',
        schoolName: '',
        monthlyRate: 150,
        customRate: false,
        batchId: '',
      }

      const payload = convertFormDataToPayload(formData)

      expect(payload.email).toBeNull()
      expect(payload.phone).toBeNull()
      expect(payload.schoolName).toBeNull()
    })

    it('should convert "none" placeholder to null', () => {
      const formData: StudentFormData = {
        name: 'John Doe',
        email: '',
        phone: '',
        dateOfBirth: null,
        educationLevel: FORM_DEFAULTS.NONE,
        gradeLevel: FORM_DEFAULTS.NONE,
        schoolName: '',
        monthlyRate: 150,
        customRate: false,
        batchId: FORM_DEFAULTS.NONE,
      }

      const payload = convertFormDataToPayload(formData)

      expect(payload.educationLevel).toBeNull()
      expect(payload.gradeLevel).toBeNull()
      expect(payload.batchId).toBeNull()
    })
  })

  describe('isFormValid', () => {
    it('should return true for valid form data', () => {
      const formData: StudentFormData = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '1234567890',
        dateOfBirth: new Date(),
        educationLevel: EducationLevel.MIDDLE_SCHOOL,
        gradeLevel: GradeLevel.GRADE_7,
        schoolName: 'School',
        monthlyRate: 150,
        customRate: false,
        batchId: 'batch-1',
      }

      expect(isFormValid(formData)).toBe(true)
    })

    it('should return false for empty name', () => {
      const formData: StudentFormData = {
        name: '',
        email: 'john@example.com',
        phone: '1234567890',
        dateOfBirth: new Date(),
        educationLevel: EducationLevel.MIDDLE_SCHOOL,
        gradeLevel: GradeLevel.GRADE_7,
        schoolName: 'School',
        monthlyRate: 150,
        customRate: false,
        batchId: 'batch-1',
      }

      expect(isFormValid(formData)).toBe(false)
    })

    it('should return false for whitespace-only name', () => {
      const formData: StudentFormData = {
        name: '   ',
        email: 'john@example.com',
        phone: '1234567890',
        dateOfBirth: new Date(),
        educationLevel: EducationLevel.MIDDLE_SCHOOL,
        gradeLevel: GradeLevel.GRADE_7,
        schoolName: 'School',
        monthlyRate: 150,
        customRate: false,
        batchId: 'batch-1',
      }

      expect(isFormValid(formData)).toBe(false)
    })

    it('should return false for negative monthly rate', () => {
      const formData: StudentFormData = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '1234567890',
        dateOfBirth: new Date(),
        educationLevel: EducationLevel.MIDDLE_SCHOOL,
        gradeLevel: GradeLevel.GRADE_7,
        schoolName: 'School',
        monthlyRate: -50,
        customRate: false,
        batchId: 'batch-1',
      }

      expect(isFormValid(formData)).toBe(false)
    })

    it('should return true for zero monthly rate', () => {
      const formData: StudentFormData = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '1234567890',
        dateOfBirth: new Date(),
        educationLevel: EducationLevel.MIDDLE_SCHOOL,
        gradeLevel: GradeLevel.GRADE_7,
        schoolName: 'School',
        monthlyRate: 0,
        customRate: false,
        batchId: 'batch-1',
      }

      expect(isFormValid(formData)).toBe(true)
    })
  })

  describe('hasFormChanges', () => {
    it('should return false when no changes made', () => {
      const formData = getDefaultFormData(mockStudent)
      expect(hasFormChanges(formData, mockStudent)).toBe(false)
    })

    it('should detect name change', () => {
      const formData = getDefaultFormData(mockStudent)
      formData.name = 'Jane Doe'
      expect(hasFormChanges(formData, mockStudent)).toBe(true)
    })

    it('should detect email change', () => {
      const formData = getDefaultFormData(mockStudent)
      formData.email = 'newemail@example.com'
      expect(hasFormChanges(formData, mockStudent)).toBe(true)
    })

    it('should detect date of birth change', () => {
      const formData = getDefaultFormData(mockStudent)
      formData.dateOfBirth = new Date('2011-01-15')
      expect(hasFormChanges(formData, mockStudent)).toBe(true)
    })

    it('should detect monthly rate change', () => {
      const formData = getDefaultFormData(mockStudent)
      formData.monthlyRate = 200
      expect(hasFormChanges(formData, mockStudent)).toBe(true)
    })

    it('should detect custom rate change', () => {
      const formData = getDefaultFormData(mockStudent)
      formData.customRate = true
      expect(hasFormChanges(formData, mockStudent)).toBe(true)
    })
  })

  describe('formatEducationLevel', () => {
    it('should format MIDDLE_SCHOOL correctly', () => {
      expect(formatEducationLevel('MIDDLE_SCHOOL')).toBe('Middle School')
    })

    it('should format ELEMENTARY correctly', () => {
      expect(formatEducationLevel('ELEMENTARY')).toBe('Elementary')
    })

    it('should format HIGH_SCHOOL correctly', () => {
      expect(formatEducationLevel('HIGH_SCHOOL')).toBe('High School')
    })

    it('should format POST_GRAD correctly', () => {
      expect(formatEducationLevel('POST_GRAD')).toBe('Post Grad')
    })

    it('should return "Not specified" for null', () => {
      expect(formatEducationLevel(null)).toBe('Not specified')
    })

    it('should return "Not specified" for empty string', () => {
      expect(formatEducationLevel('')).toBe('Not specified')
    })
  })

  describe('formatGradeLevel', () => {
    it('should format GRADE_7 correctly', () => {
      expect(formatGradeLevel('GRADE_7')).toBe('Grade 7')
    })

    it('should format KINDERGARTEN correctly', () => {
      expect(formatGradeLevel('KINDERGARTEN')).toBe('Kindergarten')
    })

    it('should format FRESHMAN correctly', () => {
      expect(formatGradeLevel('FRESHMAN')).toBe('Freshman')
    })

    it('should return "Not specified" for null', () => {
      expect(formatGradeLevel(null)).toBe('Not specified')
    })

    it('should return "Not specified" for empty string', () => {
      expect(formatGradeLevel('')).toBe('Not specified')
    })
  })
})
