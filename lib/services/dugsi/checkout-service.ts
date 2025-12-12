/**
 * Dugsi Checkout Service
 *
 * Creates Stripe Checkout Sessions for Dugsi family-based billing.
 * Centralizes checkout logic for both API route and server action callers.
 *
 * SECURITY: Always uses database child count for pricing,
 * never client-provided values.
 */

import { prisma } from '@/lib/db'
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { getDugsiKeys } from '@/lib/keys/stripe'
import { createServiceLogger, logError, logWarning } from '@/lib/logger'
import { getDugsiStripeClient } from '@/lib/stripe-dugsi'
import { validateBillingCycleAnchor } from '@/lib/utils/billing-date'
import {
  calculateDugsiRate,
  formatRate,
  formatRateDisplay,
  getStripeInterval,
  getRateTierDescription,
  MAX_EXPECTED_FAMILY_RATE,
} from '@/lib/utils/dugsi-tuition'
import { getAppUrl } from '@/lib/utils/env'
import {
  BillingStartDateSchema,
  OverrideAmountSchema,
} from '@/lib/validations/billing'

const logger = createServiceLogger('dugsi-checkout-service')

/**
 * Input for creating a Dugsi checkout session
 */
export interface CreateDugsiCheckoutInput {
  /** Family UUID */
  familyId: string
  /** Optional admin override amount in cents */
  overrideAmount?: number
  /** ISO date string for delayed billing start */
  billingStartDate?: string
  /** Custom success URL (defaults to /dugsi?payment=success) */
  successUrl?: string
  /** Custom cancel URL (defaults to /dugsi?payment=canceled) */
  cancelUrl?: string
}

/**
 * Result from creating a Dugsi checkout session
 */
export interface DugsiCheckoutResult {
  /** Stripe session ID */
  sessionId: string
  /** Checkout URL to redirect user to */
  url: string
  /** Rate calculated from child count (in cents) */
  calculatedRate: number
  /** Final rate used (calculated or override, in cents) */
  finalRate: number
  /** Whether an admin override was applied */
  isOverride: boolean
  /** Human-readable rate like "$160.00" */
  rateDescription: string
  /** Human-readable tier description */
  tierDescription: string
  /** Guardian/family name */
  familyName: string
  /** Number of children (from DB) */
  childCount: number
}

/**
 * Create a Stripe Checkout Session for a Dugsi family.
 *
 * SECURITY: Always uses database child count for pricing calculation,
 * never client-provided values. This prevents billing manipulation.
 *
 * NOTE: This service creates a Stripe checkout session - it does not modify
 * database state. The actual subscription/billing updates happen via webhook
 * after payment completion. Callers should not call revalidatePath().
 *
 * @param input - Checkout configuration
 * @returns Checkout session data
 * @throws ActionError on validation failure or Stripe errors
 */
export async function createDugsiCheckoutSession(
  input: CreateDugsiCheckoutInput
): Promise<DugsiCheckoutResult> {
  const { familyId, overrideAmount, billingStartDate } = input

  // Validate billingStartDate if provided (Zod validation per CLAUDE.md Rule 8)
  if (billingStartDate) {
    const dateResult = BillingStartDateSchema.safeParse(billingStartDate)
    if (!dateResult.success) {
      throw new ActionError(
        dateResult.error.errors[0]?.message || 'Invalid billing start date',
        ERROR_CODES.VALIDATION_ERROR,
        'billingStartDate',
        400
      )
    }
  }

  // Validate override amount if provided
  if (overrideAmount !== undefined) {
    const amountResult = OverrideAmountSchema.safeParse(overrideAmount)
    if (!amountResult.success) {
      throw new ActionError(
        amountResult.error.errors[0]?.message || 'Invalid override amount',
        ERROR_CODES.VALIDATION_ERROR,
        'overrideAmount',
        400
      )
    }
  }

  // Get app URL for default success/cancel URLs
  let appUrl: string
  try {
    appUrl = getAppUrl()
  } catch {
    throw new ActionError(
      'App URL not configured',
      ERROR_CODES.SERVER_ERROR,
      undefined,
      500
    )
  }

  const successUrl = input.successUrl ?? `${appUrl}/dugsi?payment=success`
  const cancelUrl = input.cancelUrl ?? `${appUrl}/dugsi?payment=canceled`

  // Get family profiles with guardian information
  const familyProfiles = await prisma.programProfile.findMany({
    where: {
      familyReferenceId: familyId,
      program: 'DUGSI_PROGRAM',
      status: { in: ['REGISTERED', 'ENROLLED'] },
    },
    include: {
      person: {
        include: {
          dependentRelationships: {
            where: { isActive: true },
            include: {
              guardian: {
                include: {
                  contactPoints: {
                    where: { type: 'EMAIL', isActive: true },
                    orderBy: { isPrimary: 'desc' },
                    take: 1,
                  },
                  billingAccounts: {
                    select: { stripeCustomerIdDugsi: true },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  if (familyProfiles.length === 0) {
    throw new ActionError(
      'Family not found or no active students',
      ERROR_CODES.FAMILY_NOT_FOUND,
      undefined,
      404
    )
  }

  // SECURITY: Use DB count as authoritative source
  const actualChildCount = familyProfiles.length

  // Get primary guardian (must have isPrimaryPayer set)
  const firstChild = familyProfiles[0]
  const dependentRelationships = firstChild.person.dependentRelationships || []
  const primaryPayerRelation = dependentRelationships.find(
    (r) => r.isPrimaryPayer
  )
  if (!primaryPayerRelation) {
    throw new ActionError(
      'No primary payer designated for this family. Please set a primary payer before checkout.',
      ERROR_CODES.VALIDATION_ERROR,
      'primaryPayer',
      400
    )
  }
  const primaryGuardian = primaryPayerRelation.guardian

  if (!primaryGuardian) {
    const errorMessage =
      dependentRelationships.length === 0
        ? 'No guardian relationships found for this family'
        : 'Guardian record is missing contact information'
    throw new ActionError(
      errorMessage,
      ERROR_CODES.VALIDATION_ERROR,
      undefined,
      400
    )
  }

  // Validate guardian email exists
  const guardianEmail = primaryGuardian.contactPoints[0]?.value
  if (!guardianEmail) {
    throw new ActionError(
      'Guardian must have an email address on file to receive payment link',
      ERROR_CODES.VALIDATION_ERROR,
      'guardianEmail',
      400
    )
  }

  // Calculate rate using the tuition calculator or use override
  const calculatedRate = calculateDugsiRate(actualChildCount)
  const rateInCents = overrideAmount ?? calculatedRate
  const isOverride = overrideAmount !== undefined

  if (rateInCents <= 0) {
    throw new ActionError(
      'Invalid rate calculation',
      ERROR_CODES.VALIDATION_ERROR,
      undefined,
      400
    )
  }

  // Rate bounds validation - warn on unusually high rates
  if (rateInCents > MAX_EXPECTED_FAMILY_RATE) {
    await logWarning(logger, 'Unusually high rate for Dugsi checkout', {
      rateInCents,
      maxExpected: MAX_EXPECTED_FAMILY_RATE,
      familyId,
      actualChildCount,
      isOverride,
    })
  }

  // Get Stripe interval and product ID
  const intervalConfig = getStripeInterval()
  const { productId } = getDugsiKeys()

  if (!productId) {
    await logError(
      logger,
      new Error('STRIPE_DUGSI_PRODUCT_ID not configured'),
      'Stripe product not configured for Dugsi',
      { familyId }
    )
    throw new ActionError(
      'Payment system not properly configured',
      ERROR_CODES.SERVER_ERROR,
      undefined,
      500
    )
  }

  const stripe = getDugsiStripeClient()

  // Use existing Stripe customer if available
  const customerId =
    primaryGuardian.billingAccounts[0]?.stripeCustomerIdDugsi ?? undefined

  // Build child names for metadata
  const childNames = familyProfiles.map((p) => p.person.name).join(', ')

  // Calculate and validate billing_cycle_anchor if start date provided
  let billingCycleAnchor: number | undefined
  if (billingStartDate) {
    try {
      const startDate = new Date(billingStartDate)
      billingCycleAnchor = Math.floor(startDate.getTime() / 1000)
      validateBillingCycleAnchor(billingCycleAnchor)
    } catch (error) {
      throw new ActionError(
        error instanceof Error ? error.message : 'Invalid billing start date',
        ERROR_CODES.VALIDATION_ERROR,
        'billingStartDate',
        400
      )
    }
  }

  logger.info(
    {
      familyId,
      familyName: primaryGuardian.name,
      billingStartDate: billingStartDate || 'immediate',
      billingCycleAnchor: billingCycleAnchor
        ? new Date(billingCycleAnchor * 1000).toISOString()
        : 'none',
      finalRate: rateInCents / 100,
      childCount: actualChildCount,
      isOverride,
    },
    'Creating checkout session with billing config'
  )

  // Create the checkout session
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['us_bank_account'], // ACH only
    customer: customerId,
    customer_email: customerId ? undefined : guardianEmail,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product: productId,
          unit_amount: rateInCents,
          recurring: intervalConfig,
        },
        quantity: 1,
      },
    ],
    subscription_data: {
      ...(billingCycleAnchor && {
        billing_cycle_anchor: billingCycleAnchor,
        proration_behavior: 'none' as const,
      }),
      metadata: {
        // Human-readable (for Stripe dashboard)
        Family: primaryGuardian.name,
        Children: childNames,
        Rate: formatRateDisplay(rateInCents),
        Tier: getRateTierDescription(actualChildCount),
        Source: 'Dugsi Admin Payment Link',
        // Technical (for webhook processing - DO NOT REMOVE)
        familyId,
        guardianPersonId: primaryGuardian.id,
        childCount: actualChildCount.toString(),
        profileIds: familyProfiles.map((p) => p.id).join(','),
        calculatedRate: calculatedRate.toString(),
        overrideUsed: isOverride ? 'true' : 'false',
        billingStartDate: billingStartDate || 'immediate',
        source: 'dugsi-admin-payment-link',
      },
    },
    metadata: {
      // Human-readable (for Stripe dashboard)
      Family: primaryGuardian.name,
      Source: 'Dugsi Admin Payment Link',
      // Technical (for webhook processing)
      familyId,
      guardianPersonId: primaryGuardian.id,
      childCount: actualChildCount.toString(),
      source: 'dugsi-admin-payment-link',
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
  })

  // Validate session URL was created
  if (!session.url) {
    await logError(
      logger,
      new Error('Stripe returned session without URL'),
      'Checkout session created without URL',
      { familyId, sessionId: session.id }
    )
    throw new ActionError(
      'Failed to create payment link',
      ERROR_CODES.SERVER_ERROR,
      undefined,
      500
    )
  }

  logger.info(
    {
      familyId,
      guardianName: primaryGuardian.name,
      actualChildCount,
      calculatedRate,
      finalRate: rateInCents,
      isOverride,
      sessionId: session.id,
    },
    'Dugsi checkout session created'
  )

  return {
    sessionId: session.id,
    url: session.url,
    calculatedRate,
    finalRate: rateInCents,
    isOverride,
    rateDescription: formatRate(rateInCents),
    tierDescription: getRateTierDescription(actualChildCount),
    familyName: primaryGuardian.name,
    childCount: actualChildCount,
  }
}
