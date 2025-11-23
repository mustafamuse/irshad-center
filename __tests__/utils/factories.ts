/**
 * Test Data Factories
 *
 * Factory functions to generate test data with sensible defaults.
 * Use these to create consistent, realistic test data across tests.
 *
 * Usage:
 *   const person = personFactory({ name: 'Custom Name' })
 */

import { Program, ContactType, EnrollmentStatus, SubscriptionStatus } from '@prisma/client'

/**
 * Generate a unique ID for testing
 */
export const generateId = () => crypto.randomUUID()

/**
 * Person factory - represents a student, parent, or guardian
 */
export const personFactory = (overrides: Partial<any> = {}) => ({
  id: generateId(),
  name: 'John Doe',
  dateOfBirth: new Date('2000-01-01'),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

/**
 * Contact Point factory - email or phone
 */
export const contactPointFactory = (
  overrides: Partial<any> = {}
) => ({
  id: generateId(),
  personId: generateId(),
  type: 'EMAIL' as ContactType,
  value: 'test@example.com',
  isPrimary: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

/**
 * Program Profile factory - represents enrollment in a program
 */
export const programProfileFactory = (
  overrides: Partial<any> = {}
) => ({
  id: generateId(),
  personId: generateId(),
  program: 'MAHAD_PROGRAM' as Program,
  familyReferenceId: null,
  status: 'REGISTERED' as EnrollmentStatus,
  educationLevel: null,
  gradeLevel: null,
  schoolName: null,
  monthlyRate: 150,
  customRate: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

/**
 * Enrollment factory - represents enrollment in a batch/cohort
 */
export const enrollmentFactory = (
  overrides: Partial<any> = {}
) => ({
  id: generateId(),
  programProfileId: generateId(),
  batchId: generateId(),
  status: 'ENROLLED' as EnrollmentStatus,
  startDate: new Date(),
  endDate: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

/**
 * Batch/Cohort factory
 */
export const batchFactory = (overrides: Partial<any> = {}) => ({
  id: generateId(),
  name: 'Fall 2024',
  program: 'MAHAD_PROGRAM' as Program,
  startDate: new Date('2024-09-01'),
  endDate: new Date('2025-06-30'),
  capacity: 30,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

/**
 * Subscription factory
 */
export const subscriptionFactory = (
  overrides: Partial<any> = {}
) => ({
  id: generateId(),
  billingAccountId: generateId(),
  stripeSubscriptionId: `sub_${generateId().slice(0, 24)}`,
  status: 'ACTIVE' as SubscriptionStatus,
  currentPeriodStart: new Date(),
  currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
  paidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  cancelAtPeriodEnd: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

/**
 * Billing Account factory
 */
export const billingAccountFactory = (
  overrides: Partial<any> = {}
) => ({
  id: generateId(),
  stripeCustomerIdMahad: null,
  stripeCustomerIdDugsi: null,
  paymentMethodCaptured: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

/**
 * Billing Assignment factory
 */
export const billingAssignmentFactory = (
  overrides: Partial<any> = {}
) => ({
  id: generateId(),
  programProfileId: generateId(),
  subscriptionId: generateId(),
  amount: 15000,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

/**
 * Guardian Relationship factory
 */
export const guardianRelationshipFactory = (
  overrides: Partial<any> = {}
) => ({
  id: generateId(),
  childId: generateId(),
  guardianId: generateId(),
  relationshipType: 'PARENT',
  isPrimary: true,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

/**
 * Sibling Relationship factory
 */
export const siblingRelationshipFactory = (
  overrides: Partial<any> = {}
) => ({
  id: generateId(),
  person1Id: generateId(),
  person2Id: generateId(),
  relationshipType: 'SIBLING',
  detectionMethod: 'manual' as const,
  confidence: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

/**
 * Person with Contact Points - common pattern
 */
export const personWithContactsFactory = (
  overrides: Partial<any> = {}
) => {
  const person = personFactory(overrides)
  return {
    ...person,
    contactPoints: [
      contactPointFactory({
        personId: person.id,
        type: 'EMAIL',
        value: 'test@example.com',
      }),
      contactPointFactory({
        personId: person.id,
        type: 'PHONE',
        value: '123-456-7890',
        isPrimary: false,
      }),
    ],
  }
}

/**
 * Full Mahad Student - person with profile and enrollment
 */
export const mahadStudentFactory = (overrides: Partial<any> = {}) => {
  const person = personFactory({ name: 'Ahmed Ali', ...overrides.person })
  const profile = programProfileFactory({
    personId: person.id,
    program: 'MAHAD_PROGRAM',
    ...overrides.profile,
  })
  const enrollment = enrollmentFactory({
    programProfileId: profile.id,
    ...overrides.enrollment,
  })

  return {
    ...profile,
    person: {
      ...person,
      contactPoints: [
        contactPointFactory({
          personId: person.id,
          type: 'EMAIL',
          value: 'ahmed@example.com',
        }),
      ],
    },
    enrollments: [enrollment],
  }
}

/**
 * Full Dugsi Child - person with profile and guardians
 */
export const dugsiChildFactory = (overrides: Partial<any> = {}) => {
  const person = personFactory({ name: 'Fatima Hassan', ...overrides.person })
  const profile = programProfileFactory({
    personId: person.id,
    program: 'DUGSI_PROGRAM',
    familyReferenceId: generateId(),
    ...overrides.profile,
  })

  return {
    ...profile,
    person: {
      ...person,
      contactPoints: [],
      guardianRelationships: [],
    },
  }
}
