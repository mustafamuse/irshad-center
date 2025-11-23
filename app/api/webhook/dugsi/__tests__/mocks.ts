/**
 * Shared mocks for Dugsi webhook tests
 */

import { vi } from 'vitest'

// ============================================================================
// Mocks
// ============================================================================

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue('test_signature'),
  }),
}))

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({ body, status: init?.status || 200 })),
  },
}))

vi.mock('@/lib/db', () => {
  const mockProgramProfile = {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  }

  const mockPerson = {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  }

  const mockContactPoint = {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  }

  const mockBillingAccount = {
    findFirst: vi.fn(),
    upsert: vi.fn(),
  }

  const mockSubscription = {
    findFirst: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  }

  const mockBillingAssignment = {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  }

  const mockGuardianRelationship = {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  }

  const mockEnrollment = {
    findFirst: vi.fn(),
    update: vi.fn(),
  }

  return {
    prisma: {
      programProfile: mockProgramProfile,
      person: mockPerson,
      contactPoint: mockContactPoint,
      billingAccount: mockBillingAccount,
      subscription: mockSubscription,
      billingAssignment: mockBillingAssignment,
      guardianRelationship: mockGuardianRelationship,
      enrollment: mockEnrollment,
      webhookEvent: {
        findUnique: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
      },
      // Mock $transaction to execute the callback with a transaction client
      $transaction: vi.fn((callback) => {
        const tx = {
          programProfile: mockProgramProfile,
          person: mockPerson,
          contactPoint: mockContactPoint,
          billingAccount: mockBillingAccount,
          subscription: mockSubscription,
          billingAssignment: mockBillingAssignment,
          guardianRelationship: mockGuardianRelationship,
          enrollment: mockEnrollment,
        }
        return callback(tx)
      }),
    },
  }
})

vi.mock('@/lib/stripe-dugsi', () => ({
  verifyDugsiWebhook: vi.fn(),
}))

vi.mock('@/lib/utils/dugsi-payment', () => ({
  parseDugsiReferenceId: vi.fn().mockReturnValue({
    familyId: 'dugsi_family_123',
    childCount: 2,
  }),
}))

vi.mock('@/lib/db/queries/billing', () => ({
  getBillingAccountByStripeCustomerId: vi.fn(),
  upsertBillingAccount: vi.fn(),
  createSubscription: vi.fn(),
  createBillingAssignment: vi.fn(),
  updateBillingAssignmentStatus: vi.fn(),
  updateSubscriptionStatus: vi.fn(),
  getSubscriptionByStripeId: vi.fn(),
  getBillingAssignmentsBySubscription: vi.fn(),
}))

vi.mock('@/lib/db/queries/enrollment', () => ({
  updateEnrollmentStatus: vi.fn(),
}))

vi.mock('@/lib/db/queries/program-profile', () => ({
  getProgramProfilesByFamilyId: vi.fn(),
}))
