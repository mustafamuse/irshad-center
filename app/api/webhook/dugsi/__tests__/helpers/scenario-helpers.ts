/**
 * Scenario-specific setup helpers
 */

import { vi } from 'vitest'

import { prisma } from '@/lib/db'

import {
  createMockProgramProfiles,
  createMockGuardianRelationship,
} from './factories'
import { createFullProgramProfile } from './factories-internal'
import {
  setupBillingQueryMocks,
  setupEnrollmentQueryMocks,
  setupProgramProfileQueryMocks,
} from './setup-helpers'

/**
 * Setup mocks for checkout.session.completed event scenario
 */
export async function setupCheckoutScenario(
  options: {
    profileCount?: number
    familyReferenceId?: string
    customerEmail?: string
    billingAccount?: unknown
  } = {}
) {
  const profileCount = options.profileCount ?? 2
  const profiles = createMockProgramProfiles(profileCount, {
    familyReferenceId: options.familyReferenceId,
  })

  await setupProgramProfileQueryMocks({
    getProgramProfilesByFamilyId: profiles,
  })

  await setupBillingQueryMocks({
    upsertBillingAccount: options.billingAccount ?? {
      id: 'billing_1',
      personId: 'guardian_person_1',
      accountType: 'DUGSI',
    },
  })

  // Setup Prisma mock for guardian relationship (required by handlePaymentMethodCaptured)
  // Use the first profile's personId as the dependent
  const firstProfile = profiles[0]
  if (firstProfile) {
    const guardianRelationship = createMockGuardianRelationship({
      dependentId: firstProfile.personId,
    })

    const findFirstGuardianFn = prisma.guardianRelationship
      .findFirst as unknown as { mockResolvedValue: (value: unknown) => void }
    if (
      typeof findFirstGuardianFn === 'function' &&
      'mockResolvedValue' in findFirstGuardianFn
    ) {
      findFirstGuardianFn.mockResolvedValue(
        guardianRelationship as unknown as Awaited<
          ReturnType<typeof prisma.guardianRelationship.findFirst>
        >
      )
    }
  }
}

/**
 * Setup mocks for subscription.created event scenario
 */
export async function setupSubscriptionCreatedScenario(
  options: {
    profileCount?: number
    subscriptionId?: string
    billingAccount?: unknown
    subscription?: unknown
  } = {}
) {
  const profileCount = options.profileCount ?? 2
  const profiles = createMockProgramProfiles(profileCount)

  await setupBillingQueryMocks({
    getBillingAccountByStripeCustomerId: options.billingAccount ?? {
      id: 'billing_1',
      personId: 'guardian_person_1',
      accountType: 'DUGSI',
    },
    createSubscription: options.subscription ?? {
      id: 'sub_1',
      stripeSubscriptionId: options.subscriptionId || 'sub_test123',
    },
    getBillingAssignmentsBySubscription: [],
  })

  // Setup Prisma mocks for guardian relationships
  const guardianRelationships = Array.from({ length: profileCount }, (_, i) =>
    createMockGuardianRelationship({
      dependentId: `person_${i + 1}`,
      dependent: {
        id: `person_${i + 1}`,
        name: `Child ${i + 1}`,
        programProfiles: [
          createFullProgramProfile({
            id: `profile_${i + 1}`,
            personId: `person_${i + 1}`,
            familyReferenceId:
              profiles[i]?.familyReferenceId === null
                ? undefined
                : (profiles[i]?.familyReferenceId ?? undefined),
          }),
        ],
      },
    })
  )

  const findManyGuardianFn = prisma.guardianRelationship
    .findMany as unknown as { mockResolvedValue: (value: unknown) => void }
  if (
    typeof findManyGuardianFn === 'function' &&
    'mockResolvedValue' in findManyGuardianFn
  ) {
    findManyGuardianFn.mockResolvedValue(
      guardianRelationships as unknown as Awaited<
        ReturnType<typeof prisma.guardianRelationship.findMany>
      >
    )
  }

  const findManyProfileFn = prisma.programProfile.findMany as unknown as {
    mockResolvedValue: (value: unknown) => void
  }
  if (
    typeof findManyProfileFn === 'function' &&
    'mockResolvedValue' in findManyProfileFn
  ) {
    findManyProfileFn.mockResolvedValue(
      profiles.map((p) =>
        createFullProgramProfile({
          ...p,
          familyReferenceId: p.familyReferenceId ?? undefined,
        })
      ) as unknown as Awaited<ReturnType<typeof prisma.programProfile.findMany>>
    )
  }
}

/**
 * Setup mocks for subscription.updated event scenario
 */
export async function setupSubscriptionUpdatedScenario(
  options: {
    subscriptionId?: string
    currentStatus?: string
    newStatus?: string
    billingAccount?: unknown
  } = {}
) {
  await setupBillingQueryMocks({
    getBillingAccountByStripeCustomerId: options.billingAccount ?? {
      id: 'billing_1',
      personId: 'guardian_person_1',
      accountType: 'DUGSI',
    },
    getSubscriptionByStripeId: {
      id: 'sub_1',
      stripeSubscriptionId: options.subscriptionId || 'sub_test123',
      status: options.currentStatus || 'active',
    },
    updateSubscriptionStatus: {
      id: 'sub_1',
      status: options.newStatus || 'past_due',
    },
  })
}

/**
 * Setup mocks for subscription.deleted event scenario
 */
export async function setupSubscriptionDeletedScenario(
  options: {
    subscriptionId?: string
    assignmentCount?: number
  } = {}
) {
  const assignmentCount = options.assignmentCount ?? 2
  const assignments = Array.from({ length: assignmentCount }, (_, i) => ({
    id: `assignment_${i + 1}`,
    programProfileId: `profile_${i + 1}`,
    isActive: true,
  }))

  await setupBillingQueryMocks({
    getSubscriptionByStripeId: {
      id: 'sub_1',
      stripeSubscriptionId: options.subscriptionId || 'sub_test123',
      status: 'active',
    },
    getBillingAssignmentsBySubscription: assignments,
    updateBillingAssignmentStatus: {
      id: 'assignment_1',
      isActive: false,
    },
    updateSubscriptionStatus: {
      id: 'sub_1',
      status: 'canceled',
    },
  })

  await setupEnrollmentQueryMocks({
    updateEnrollmentStatus: {
      id: 'enrollment_1',
      status: 'WITHDRAWN',
    },
  })

  const findFirstEnrollmentFn = prisma.enrollment.findFirst as unknown as {
    mockResolvedValue: (value: unknown) => void
  }
  if (
    typeof findFirstEnrollmentFn === 'function' &&
    'mockResolvedValue' in findFirstEnrollmentFn
  ) {
    findFirstEnrollmentFn.mockResolvedValue({
      id: 'enrollment_1',
      status: 'ENROLLED',
    } as unknown as Awaited<ReturnType<typeof prisma.enrollment.findFirst>>)
  }
}
