/**
 * Test Factories
 *
 * Reusable mock factories for testing with the new ProgramProfile/Person/Enrollment schema.
 * Created during schema migration to reduce test maintenance burden.
 *
 * Usage:
 * ```ts
 * import { createMockPerson, createMockProgramProfile } from '@/lib/__tests__/factories'
 *
 * const person = createMockPerson({ name: 'John Doe' })
 * const profile = createMockProgramProfile({ personId: person.id })
 * ```
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type {
  Person,
  ContactPoint,
  ProgramProfile,
  Enrollment,
  SiblingRelationship,
  Batch,
  BillingAssignment,
  Subscription,
  BillingAccount,
  StudentPayment,
  Program,
  EnrollmentStatus,
  EducationLevel,
  GradeLevel,
  ContactType,
  SubscriptionStatus,
} from '@prisma/client'

// ============================================================================
// PERSON & CONTACT FACTORIES
// ============================================================================

export function createMockPerson(overrides: Partial<Person> = {}): Person {
  const now = new Date()
  return {
    id: `person_${Math.random().toString(36).substr(2, 9)}`,
    name: 'Test Student',
    dateOfBirth: new Date('2010-01-01'),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export function createMockContactPoint(
  overrides: Partial<ContactPoint> = {}
): ContactPoint {
  const now = new Date()
  return {
    id: `contact_${Math.random().toString(36).substr(2, 9)}`,
    personId: 'person_test',
    type: 'EMAIL' as ContactType,
    value: 'test@example.com',
    isPrimary: true,
    verificationStatus: 'UNVERIFIED',
    verifiedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

// ============================================================================
// PROGRAM PROFILE & ENROLLMENT FACTORIES
// ============================================================================

export function createMockProgramProfile(
  overrides: Partial<ProgramProfile> = {}
): ProgramProfile {
  const now = new Date()
  return {
    id: `profile_${Math.random().toString(36).substr(2, 9)}`,
    personId: 'person_test',
    program: 'MAHAD_PROGRAM' as Program,
    educationLevel: 'HIGH_SCHOOL' as EducationLevel,
    gradeLevel: 'GRADE_10' as GradeLevel,
    schoolName: 'Test School',
    metadata: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export function createMockEnrollment(
  overrides: Partial<Enrollment> = {}
): Enrollment {
  const now = new Date()
  return {
    id: `enrollment_${Math.random().toString(36).substr(2, 9)}`,
    programProfileId: 'profile_test',
    batchId: null,
    status: 'ENROLLED' as EnrollmentStatus,
    startDate: now,
    endDate: null,
    monthlyRate: 150,
    customRate: false,
    notes: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

// ============================================================================
// BATCH FACTORY
// ============================================================================

export function createMockBatch(overrides: Partial<Batch> = {}): Batch {
  const now = new Date()
  return {
    id: `batch_${Math.random().toString(36).substr(2, 9)}`,
    name: 'Test Batch',
    program: 'MAHAD_PROGRAM' as Program,
    startDate: now,
    endDate: null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

// ============================================================================
// SIBLING RELATIONSHIP FACTORY
// ============================================================================

export function createMockSiblingRelationship(
  overrides: Partial<SiblingRelationship> = {}
): SiblingRelationship {
  const now = new Date()
  return {
    id: `sibling_${Math.random().toString(36).substr(2, 9)}`,
    person1Id: 'person_1',
    person2Id: 'person_2',
    detectionMethod: 'MANUAL',
    confidence: 1.0,
    verifiedBy: 'admin@example.com',
    verifiedAt: now,
    isActive: true,
    notes: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

// ============================================================================
// BILLING & SUBSCRIPTION FACTORIES
// ============================================================================

export function createMockBillingAccount(
  overrides: Partial<BillingAccount> = {}
): BillingAccount {
  const now = new Date()
  return {
    id: `billing_${Math.random().toString(36).substr(2, 9)}`,
    personId: 'person_test',
    contactPointId: 'contact_test',
    stripeCustomerId: `cus_${Math.random().toString(36).substr(2, 14)}`,
    accountType: 'MAHAD',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export function createMockSubscription(
  overrides: Partial<Subscription> = {}
): Subscription {
  const now = new Date()
  return {
    id: `sub_${Math.random().toString(36).substr(2, 9)}`,
    billingAccountId: 'billing_test',
    stripeSubscriptionId: `sub_${Math.random().toString(36).substr(2, 14)}`,
    status: 'active' as SubscriptionStatus,
    currentPeriodStart: now,
    currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // +30 days
    cancelAtPeriodEnd: false,
    canceledAt: null,
    amount: 150,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export function createMockBillingAssignment(
  overrides: Partial<BillingAssignment> = {}
): BillingAssignment {
  const now = new Date()
  return {
    id: `assignment_${Math.random().toString(36).substr(2, 9)}`,
    subscriptionId: 'sub_test',
    programProfileId: 'profile_test',
    isActive: true,
    startDate: now,
    endDate: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export function createMockStudentPayment(
  overrides: Partial<StudentPayment> = {}
): StudentPayment {
  const now = new Date()
  return {
    id: `payment_${Math.random().toString(36).substr(2, 9)}`,
    programProfileId: 'profile_test',
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    amountPaid: 150,
    paidAt: now,
    stripeInvoiceId: `in_${Math.random().toString(36).substr(2, 14)}`,
    ...overrides,
  }
}

// ============================================================================
// STRIPE MOCK FACTORIES
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createMockStripeCheckoutSession(
  overrides: Record<string, any> = {}
) {
  return {
    id: `cs_test_${Math.random().toString(36).substr(2, 20)}`,
    object: 'checkout.session',
    mode: 'subscription',
    status: 'complete',
    customer: `cus_${Math.random().toString(36).substr(2, 14)}`,
    subscription: `sub_${Math.random().toString(36).substr(2, 14)}`,
    customer_email: 'test@example.com',
    custom_fields: [],
    metadata: {},
    ...overrides,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createMockStripeSubscription(
  overrides: Record<string, any> = {}
) {
  const now = Math.floor(Date.now() / 1000)
  return {
    id: `sub_${Math.random().toString(36).substr(2, 14)}`,
    object: 'subscription',
    customer: `cus_${Math.random().toString(36).substr(2, 14)}`,
    status: 'active',
    current_period_start: now,
    current_period_end: now + 30 * 24 * 60 * 60, // +30 days
    cancel_at_period_end: false,
    canceled_at: null,
    items: {
      data: [
        {
          id: `si_${Math.random().toString(36).substr(2, 14)}`,
          price: {
            id: `price_${Math.random().toString(36).substr(2, 14)}`,
            unit_amount: 15000, // $150.00
          },
        },
      ],
    },
    metadata: {},
    ...overrides,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createMockStripeCustomer(overrides: Record<string, any> = {}) {
  return {
    id: `cus_${Math.random().toString(36).substr(2, 14)}`,
    object: 'customer',
    email: 'test@example.com',
    name: 'Test Customer',
    phone: '+1234567890',
    metadata: {},
    ...overrides,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createMockStripeInvoice(overrides: Record<string, any> = {}) {
  const now = Math.floor(Date.now() / 1000)
  return {
    id: `in_${Math.random().toString(36).substr(2, 14)}`,
    object: 'invoice',
    customer: `cus_${Math.random().toString(36).substr(2, 14)}`,
    subscription: `sub_${Math.random().toString(36).substr(2, 14)}`,
    status: 'paid',
    total: 15000, // $150.00
    period_start: now,
    period_end: now + 30 * 24 * 60 * 60,
    ...overrides,
  }
}

// ============================================================================
// COMPOSITE FACTORIES (Common combinations)
// ============================================================================

/**
 * Creates a complete student record with Person, ContactPoints, ProgramProfile, and Enrollment
 */
export function createCompleteStudent(
  overrides: {
    person?: Partial<Person>
    email?: Partial<ContactPoint>
    phone?: Partial<ContactPoint>
    profile?: Partial<ProgramProfile>
    enrollment?: Partial<Enrollment>
  } = {}
) {
  const person = createMockPerson(overrides.person)
  const email = createMockContactPoint({
    personId: person.id,
    type: 'EMAIL',
    value: 'student@example.com',
    ...overrides.email,
  })
  const phone = createMockContactPoint({
    personId: person.id,
    type: 'PHONE',
    value: '+1234567890',
    isPrimary: false,
    ...overrides.phone,
  })
  const profile = createMockProgramProfile({
    personId: person.id,
    ...overrides.profile,
  })
  const enrollment = createMockEnrollment({
    programProfileId: profile.id,
    ...overrides.enrollment,
  })

  return {
    person,
    contactPoints: [email, phone],
    profile,
    enrollment,
  }
}

/**
 * Creates a complete billing setup with Account, Subscription, and Assignment
 */
export function createCompleteBilling(
  overrides: {
    account?: Partial<BillingAccount>
    subscription?: Partial<Subscription>
    assignment?: Partial<BillingAssignment>
  } = {}
) {
  const account = createMockBillingAccount(overrides.account)
  const subscription = createMockSubscription({
    billingAccountId: account.id,
    ...overrides.subscription,
  })
  const assignment = createMockBillingAssignment({
    subscriptionId: subscription.id,
    ...overrides.assignment,
  })

  return {
    account,
    subscription,
    assignment,
  }
}
