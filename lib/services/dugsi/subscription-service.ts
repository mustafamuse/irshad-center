/**
 * Dugsi Subscription Service
 *
 * Dugsi-specific subscription operations.
 * Wraps shared subscription service with Dugsi family logic.
 *
 * Responsibilities:
 * - Validate Dugsi subscriptions
 * - Link subscriptions to Dugsi families
 * - Check Dugsi payment status
 * - Handle family-based billing assignments
 */

import { DUGSI_PROGRAM } from '@/lib/constants/dugsi'
import { prisma } from '@/lib/db'
import { getSubscriptionByStripeId } from '@/lib/db/queries/billing'
import { getProgramProfilesByFamilyId } from '@/lib/db/queries/program-profile'
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import {
  validateStripeSubscription,
  linkSubscriptionToProfiles,
} from '@/lib/services/shared'

/**
 * Result type for subscription validation
 */
export interface SubscriptionValidationResult {
  subscriptionId: string
  customerId: string
  status: string
  currentPeriodStart: Date | null
  currentPeriodEnd: Date | null
}

/**
 * Result type for subscription linking
 */
export interface SubscriptionLinkResult {
  updated: number
}

/**
 * Result type for payment status
 */
export interface PaymentStatusResult {
  paymentMethodCaptured: boolean
  paymentMethodCapturedAt: Date | null
  stripeCustomerId: string | null
  subscriptionStatus: string | null
  paidUntil: Date | null
  hasActiveSubscription: boolean
}

/**
 * Validate a Dugsi Stripe subscription.
 *
 * Delegates to shared subscription service with DUGSI account type.
 *
 * @param subscriptionId - Stripe subscription ID (must start with 'sub_')
 * @returns Subscription validation data
 * @throws Error if subscription is invalid or not found
 */
export async function validateDugsiSubscription(
  subscriptionId: string
): Promise<SubscriptionValidationResult> {
  return await validateStripeSubscription(subscriptionId, 'DUGSI')
}

/**
 * Link a Stripe subscription to a Dugsi family.
 *
 * Process:
 * 1. Verify subscription exists in database
 * 2. Find parent by email
 * 3. Get all Dugsi family members
 * 4. Delegate to shared service to create billing assignments
 *
 * @param parentEmail - Parent's email address
 * @param subscriptionId - Stripe subscription ID
 * @returns Number of profiles linked
 * @throws Error if parent not found or subscription invalid
 */
export async function linkDugsiSubscription(
  parentEmail: string,
  subscriptionId: string
): Promise<SubscriptionLinkResult> {
  // Get subscription from database
  const subscription = await getSubscriptionByStripeId(subscriptionId)
  if (!subscription) {
    throw new ActionError(
      'Subscription not found in database',
      ERROR_CODES.SUBSCRIPTION_NOT_FOUND,
      undefined,
      404
    )
  }

  // Find person by email (parent)
  const person = await prisma.person.findFirst({
    where: {
      contactPoints: {
        some: {
          type: 'EMAIL',
          value: parentEmail.toLowerCase().trim(),
        },
      },
    },
    include: {
      programProfiles: {
        where: {
          program: DUGSI_PROGRAM,
        },
      },
    },
  })

  if (!person) {
    throw new ActionError(
      'Parent not found with this email address',
      ERROR_CODES.PARENT_NOT_FOUND,
      undefined,
      404
    )
  }

  // Get family profiles
  const profiles = person.programProfiles || []
  if (profiles.length === 0) {
    throw new ActionError(
      'No Dugsi registrations found for this email',
      ERROR_CODES.PROFILE_NOT_FOUND,
      undefined,
      404
    )
  }

  // Get family reference ID from first profile
  const familyId = profiles[0].familyReferenceId
  let familyProfiles = profiles

  // If familyReferenceId exists, get all family members
  if (familyId) {
    familyProfiles = await getProgramProfilesByFamilyId(familyId)
  }

  // Extract profile IDs
  const profileIds = familyProfiles.map((p) => p.id)

  // Use shared service to link subscription to all family profiles
  const linkedCount = await linkSubscriptionToProfiles(
    subscription.id,
    profileIds,
    subscription.amount,
    'Linked manually by admin'
  )

  return {
    updated: linkedCount,
  }
}

/**
 * Get payment status for a Dugsi family by parent email.
 *
 * Returns information about:
 * - Payment method capture status
 * - Stripe customer ID
 * - Subscription status
 * - Payment period
 *
 * @param parentEmail - Parent's email address
 * @returns Payment status information
 * @throws Error if parent not found
 */
export async function getDugsiPaymentStatus(
  parentEmail: string
): Promise<PaymentStatusResult> {
  // Find person by email
  const person = await prisma.person.findFirst({
    where: {
      contactPoints: {
        some: {
          type: 'EMAIL',
          value: parentEmail.toLowerCase().trim(),
        },
      },
    },
    include: {
      billingAccounts: {
        where: {
          accountType: 'DUGSI',
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
    throw new ActionError(
      'Parent not found with this email address',
      ERROR_CODES.PARENT_NOT_FOUND,
      undefined,
      404
    )
  }

  // Get billing account
  const billingAccount = person.billingAccounts?.[0]
  const activeSubscription = billingAccount?.subscriptions?.[0]

  return {
    paymentMethodCaptured: billingAccount?.paymentMethodCaptured ?? false,
    paymentMethodCapturedAt: billingAccount?.paymentMethodCapturedAt ?? null,
    stripeCustomerId: billingAccount?.stripeCustomerIdDugsi ?? null,
    subscriptionStatus: activeSubscription?.status ?? null,
    paidUntil: activeSubscription?.paidUntil ?? null,
    hasActiveSubscription: !!activeSubscription,
  }
}
