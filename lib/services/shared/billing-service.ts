/**
 * Shared Billing Service
 *
 * Cross-program billing operations for both Dugsi and Mahad.
 * Handles billing accounts, subscriptions, and payment assignments.
 *
 * This service is program-agnostic - it works with any StripeAccountType.
 *
 * Responsibilities:
 * - Manage billing accounts
 * - Link subscriptions to profiles
 * - Calculate payment splits
 * - Get billing status
 */

import { StripeAccountType } from '@prisma/client'
import * as Sentry from '@sentry/nextjs'

import { prisma } from '@/lib/db'
import {
  getBillingAccountByStripeCustomerId as getBillingAccountByCustomerIdQuery,
  upsertBillingAccount as upsertBillingAccountQuery,
  createBillingAssignment as createBillingAssignmentQuery,
  updateBillingAssignmentStatus,
  getBillingAssignmentsByProfile,
  getBillingAssignmentsBySubscription,
} from '@/lib/db/queries/billing'

/**
 * Billing account data for creation/update
 */
export interface BillingAccountInput {
  personId: string | null
  accountType: StripeAccountType
  stripeCustomerId?: string
  paymentMethodCaptured?: boolean
  paymentMethodCapturedAt?: Date
  paymentIntentId?: string
}

/**
 * Billing assignment input
 */
export interface BillingAssignmentInput {
  subscriptionId: string
  programProfileId: string
  amount: number
  percentage?: number | null
  notes?: string
}

/**
 * Billing status result
 */
export interface BillingStatusResult {
  hasPaymentMethod: boolean
  hasActiveSubscription: boolean
  stripeCustomerId: string | null
  subscriptionStatus: string | null
  paidUntil: Date | null
  currentPeriodStart: Date | null
  currentPeriodEnd: Date | null
}

/**
 * Get billing account by Stripe customer ID.
 *
 * @param stripeCustomerId - Stripe customer ID
 * @param accountType - Account type (MAHAD, DUGSI, etc.)
 * @returns Billing account or null
 */
export async function getBillingAccountByCustomerId(
  stripeCustomerId: string,
  accountType: StripeAccountType
) {
  return await getBillingAccountByCustomerIdQuery(stripeCustomerId, accountType)
}

/**
 * Create or update a billing account.
 *
 * Uses upsert logic - creates if doesn't exist, updates if exists.
 *
 * @param input - Billing account data
 * @returns Created or updated billing account
 */
export async function createOrUpdateBillingAccount(input: BillingAccountInput) {
  // Map input to the format expected by the query function
  const data: {
    personId?: string | null
    accountType: StripeAccountType
    stripeCustomerIdMahad?: string | null
    stripeCustomerIdDugsi?: string | null
    stripeCustomerIdYouth?: string | null
    stripeCustomerIdDonation?: string | null
    paymentIntentIdDugsi?: string | null
    paymentMethodCaptured?: boolean
    paymentMethodCapturedAt?: Date | null
    primaryContactPointId?: string | null
  } = {
    personId: input.personId,
    accountType: input.accountType,
  }

  // Add Stripe customer ID based on account type
  switch (input.accountType) {
    case 'MAHAD':
      if (input.stripeCustomerId) {
        data.stripeCustomerIdMahad = input.stripeCustomerId
      }
      break
    case 'DUGSI':
      if (input.stripeCustomerId) {
        data.stripeCustomerIdDugsi = input.stripeCustomerId
      }
      if (input.paymentIntentId) {
        data.paymentIntentIdDugsi = input.paymentIntentId
      }
      break
    case 'YOUTH_EVENTS':
      if (input.stripeCustomerId) {
        data.stripeCustomerIdYouth = input.stripeCustomerId
      }
      break
    case 'GENERAL_DONATION':
      if (input.stripeCustomerId) {
        data.stripeCustomerIdDonation = input.stripeCustomerId
      }
      break
  }

  // Add payment method capture info
  if (input.paymentMethodCaptured !== undefined) {
    data.paymentMethodCaptured = input.paymentMethodCaptured
  }
  if (input.paymentMethodCapturedAt) {
    data.paymentMethodCapturedAt = input.paymentMethodCapturedAt
  }

  return await upsertBillingAccountQuery(data)
}

/**
 * Link a subscription to program profiles by creating billing assignments.
 *
 * Splits the subscription amount evenly across all profiles.
 * Assigns remainder to last profile to ensure exact total.
 *
 * @param subscriptionId - Subscription ID
 * @param programProfileIds - Array of program profile IDs
 * @param totalAmount - Total subscription amount in cents
 * @param notes - Optional notes
 * @returns Number of assignments created
 */
export async function linkSubscriptionToProfiles(
  subscriptionId: string,
  programProfileIds: string[],
  totalAmount: number,
  notes?: string
): Promise<number> {
  if (programProfileIds.length === 0) {
    throw new Error('At least one profile ID is required')
  }

  // Batch fetch all existing assignments for all profiles to avoid N+1
  const allExistingAssignments = await prisma.billingAssignment.findMany({
    where: {
      programProfileId: { in: programProfileIds },
      subscriptionId,
      isActive: true,
    },
    select: {
      programProfileId: true,
    },
  })

  // Create a Set of profile IDs that already have assignments
  const existingProfileIds = new Set(
    allExistingAssignments.map((a) => a.programProfileId)
  )

  // Calculate split amounts
  const amounts = calculateSplitAmounts(totalAmount, programProfileIds.length)

  // Use transaction to ensure all assignments are created atomically
  const created = await Sentry.startSpan(
    {
      name: 'billing.create_assignments_transaction',
      op: 'db.transaction',
      attributes: {
        subscription_id: subscriptionId,
        num_profiles: programProfileIds.length,
        total_amount: totalAmount,
      },
    },
    async () =>
      await prisma.$transaction(async (tx) => {
        let count = 0

        for (let i = 0; i < programProfileIds.length; i++) {
          const profileId = programProfileIds[i]
          const amount = amounts[i]

          // Check if assignment already exists using the Set
          if (!existingProfileIds.has(profileId)) {
            // Calculate percentage
            const percentage =
              programProfileIds.length > 1 ? (amount / totalAmount) * 100 : null

            await createBillingAssignmentQuery(
              {
                subscriptionId,
                programProfileId: profileId,
                amount,
                percentage,
                notes,
              },
              tx
            )

            count++
          }
        }

        return count
      })
  )

  return created
}

/**
 * Unlink a subscription from all profiles.
 *
 * Deactivates all billing assignments for the subscription.
 *
 * @param subscriptionId - Subscription ID
 * @returns Number of assignments deactivated
 */
export async function unlinkSubscription(
  subscriptionId: string
): Promise<number> {
  const assignments = await getBillingAssignmentsBySubscription(subscriptionId)

  // Use transaction to ensure all assignments are deactivated atomically
  const deactivated = await prisma.$transaction(async (tx) => {
    let count = 0

    for (const assignment of assignments) {
      if (assignment.isActive) {
        await updateBillingAssignmentStatus(
          assignment.id,
          false,
          new Date(),
          tx
        )
        count++
      }
    }

    return count
  })

  return deactivated
}

/**
 * Calculate split amounts for family billing.
 *
 * Splits total evenly, assigns remainder to last item to ensure
 * sum equals total exactly (avoids rounding issues).
 *
 * @param totalAmount - Total amount in cents
 * @param count - Number of splits
 * @returns Array of amounts for each split
 *
 * @example
 * calculateSplitAmounts(500, 2)  // [250, 250]
 */
export function calculateSplitAmounts(
  totalAmount: number,
  count: number
): number[] {
  if (count <= 0) {
    throw new Error('Count must be positive')
  }

  if (count === 1) {
    return [totalAmount]
  }

  const baseAmount = Math.floor(totalAmount / count)
  const remainder = totalAmount - baseAmount * count

  const amounts: number[] = []
  for (let i = 0; i < count; i++) {
    // Assign remainder to last item
    const amount = i === count - 1 ? baseAmount + remainder : baseAmount
    amounts.push(amount)
  }

  return amounts
}

/**
 * Get billing status for a person by email.
 *
 * Finds the person's billing account and active subscription.
 *
 * @param email - Person's email address
 * @param accountType - Account type to check
 * @returns Billing status information
 */
export async function getBillingStatusByEmail(
  email: string,
  accountType: StripeAccountType
): Promise<BillingStatusResult> {
  // Find person by email
  const person = await prisma.person.findFirst({
    where: {
      contactPoints: {
        some: {
          type: 'EMAIL',
          value: email.toLowerCase().trim(),
        },
      },
    },
    include: {
      billingAccounts: {
        where: {
          accountType,
        },
        include: {
          subscriptions: {
            where: {
              status: {
                in: ['active', 'trialing'],
              },
            },
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
        },
      },
    },
  })

  if (!person) {
    throw new Error('Person not found with this email address')
  }

  // Get billing account
  const billingAccount = person.billingAccounts?.[0]
  const activeSubscription = billingAccount?.subscriptions?.[0]

  // Get customer ID based on account type
  let stripeCustomerId: string | null = null
  switch (accountType) {
    case 'MAHAD':
      stripeCustomerId = billingAccount?.stripeCustomerIdMahad ?? null
      break
    case 'DUGSI':
      stripeCustomerId = billingAccount?.stripeCustomerIdDugsi ?? null
      break
    case 'YOUTH_EVENTS':
      stripeCustomerId = billingAccount?.stripeCustomerIdYouth ?? null
      break
    case 'GENERAL_DONATION':
      stripeCustomerId = billingAccount?.stripeCustomerIdDonation ?? null
      break
  }

  return {
    hasPaymentMethod: billingAccount?.paymentMethodCaptured ?? false,
    hasActiveSubscription: !!activeSubscription,
    stripeCustomerId,
    subscriptionStatus: activeSubscription?.status ?? null,
    paidUntil: activeSubscription?.paidUntil ?? null,
    currentPeriodStart: activeSubscription?.currentPeriodStart ?? null,
    currentPeriodEnd: activeSubscription?.currentPeriodEnd ?? null,
  }
}

/**
 * Get billing status for program profiles.
 *
 * Checks if profiles have active billing assignments.
 *
 * @param programProfileIds - Array of profile IDs
 * @returns Map of profile ID to billing status
 */
export async function getBillingStatusForProfiles(
  programProfileIds: string[]
): Promise<Map<string, { hasSubscription: boolean; amount: number | null }>> {
  const statusMap = new Map<
    string,
    { hasSubscription: boolean; amount: number | null }
  >()

  for (const profileId of programProfileIds) {
    const assignments = await getBillingAssignmentsByProfile(profileId)
    const activeAssignment = assignments.find((a) => a.isActive)

    statusMap.set(profileId, {
      hasSubscription: !!activeAssignment,
      amount: activeAssignment?.amount ?? null,
    })
  }

  return statusMap
}
