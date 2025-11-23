/**
 * Setup helpers for query function mocks
 */

import { vi } from 'vitest'

/**
 * Setup default mocks for all billing query functions
 */
export async function setupBillingQueryMocks(
  overrides: {
    getBillingAccountByStripeCustomerId?: unknown
    upsertBillingAccount?: unknown
    createSubscription?: unknown
    createBillingAssignment?: unknown
    updateBillingAssignmentStatus?: unknown
    updateSubscriptionStatus?: unknown
    getSubscriptionByStripeId?: unknown
    getBillingAssignmentsBySubscription?: unknown[]
  } = {}
) {
  const {
    getBillingAccountByStripeCustomerId,
    upsertBillingAccount,
    createSubscription,
    createBillingAssignment,
    updateBillingAssignmentStatus,
    updateSubscriptionStatus,
    getSubscriptionByStripeId,
    getBillingAssignmentsBySubscription,
  } = await import('@/lib/db/queries/billing')

  vi.mocked(getBillingAccountByStripeCustomerId).mockResolvedValue(
    (overrides.getBillingAccountByStripeCustomerId ?? null) as Awaited<
      ReturnType<typeof getBillingAccountByStripeCustomerId>
    >
  )
  vi.mocked(upsertBillingAccount).mockResolvedValue(
    (overrides.upsertBillingAccount ?? {
      id: 'billing_1',
      personId: 'guardian_person_1',
      accountType: 'DUGSI',
    }) as Awaited<ReturnType<typeof upsertBillingAccount>>
  )
  vi.mocked(createSubscription).mockResolvedValue(
    (overrides.createSubscription ?? {
      id: 'sub_1',
      stripeSubscriptionId: 'sub_test123',
    }) as Awaited<ReturnType<typeof createSubscription>>
  )
  vi.mocked(createBillingAssignment).mockResolvedValue(
    (overrides.createBillingAssignment ?? {
      id: 'assignment_1',
    }) as Awaited<ReturnType<typeof createBillingAssignment>>
  )
  vi.mocked(updateBillingAssignmentStatus).mockResolvedValue(
    (overrides.updateBillingAssignmentStatus ?? {
      id: 'assignment_1',
      isActive: false,
    }) as Awaited<ReturnType<typeof updateBillingAssignmentStatus>>
  )
  vi.mocked(updateSubscriptionStatus).mockResolvedValue(
    (overrides.updateSubscriptionStatus ?? {
      id: 'sub_1',
      status: 'active',
    }) as Awaited<ReturnType<typeof updateSubscriptionStatus>>
  )
  vi.mocked(getSubscriptionByStripeId).mockResolvedValue(
    (overrides.getSubscriptionByStripeId ?? null) as Awaited<
      ReturnType<typeof getSubscriptionByStripeId>
    >
  )
  vi.mocked(getBillingAssignmentsBySubscription).mockResolvedValue(
    (overrides.getBillingAssignmentsBySubscription ?? []) as Awaited<
      ReturnType<typeof getBillingAssignmentsBySubscription>
    >
  )
}

/**
 * Setup default mocks for enrollment query functions
 */
export async function setupEnrollmentQueryMocks(
  overrides: {
    updateEnrollmentStatus?: unknown
  } = {}
) {
  const { updateEnrollmentStatus } = await import('@/lib/db/queries/enrollment')

  vi.mocked(updateEnrollmentStatus).mockResolvedValue(
    (overrides.updateEnrollmentStatus ?? {
      id: 'enrollment_1',
      status: 'WITHDRAWN',
    }) as Awaited<ReturnType<typeof updateEnrollmentStatus>>
  )
}

/**
 * Setup default mocks for program profile query functions
 */
export async function setupProgramProfileQueryMocks(
  overrides: {
    getProgramProfilesByFamilyId?: unknown[]
  } = {}
) {
  const { getProgramProfilesByFamilyId } = await import(
    '@/lib/db/queries/program-profile'
  )

  vi.mocked(getProgramProfilesByFamilyId).mockResolvedValue(
    (overrides.getProgramProfilesByFamilyId ?? []) as Awaited<
      ReturnType<typeof getProgramProfilesByFamilyId>
    >
  )
}

/**
 * Setup all default query function mocks at once
 */
export async function setupAllQueryMocks(
  overrides: {
    billing?: Parameters<typeof setupBillingQueryMocks>[0]
    enrollment?: Parameters<typeof setupEnrollmentQueryMocks>[0]
    programProfile?: Parameters<typeof setupProgramProfileQueryMocks>[0]
  } = {}
) {
  await setupBillingQueryMocks(overrides.billing)
  await setupEnrollmentQueryMocks(overrides.enrollment)
  await setupProgramProfileQueryMocks(overrides.programProfile)
}
