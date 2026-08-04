'use server'

import {
  GraduationStatus,
  PaymentFrequency,
  StudentBillingType,
} from '@prisma/client'
import { z } from 'zod'


import { featureFlags } from '@/lib/config/feature-flags'
import {
  getProfileForPaymentLink,
  getMahadStripeCustomerId,
  hasLiveMahadSubscription,
} from '@/lib/db/queries/student'
import { LIVE_SUBSCRIPTION_STATUSES } from '@/lib/db/query-builders'
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { getMahadKeys } from '@/lib/keys/stripe'
import { createActionLogger, logError } from '@/lib/logger'
import { adminActionClient } from '@/lib/safe-action'
import { getMahadStripeClient } from '@/lib/stripe-mahad'
import { validateBillingCycleAnchor } from '@/lib/utils/billing-date'
import {
  calculateMahadRate,
  getStripeInterval,
} from '@/lib/utils/mahad-tuition'
import {
  BillingStartDateSchema,
  OverrideAmountSchema,
} from '@/lib/validations/billing'
import { MAX_EXPECTED_RATE_CENTS } from '@/lib/validations/checkout'

const logger = createActionLogger('mahad')

function isStaleStripeCustomer(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const e = error as { type?: string; code?: string; param?: string }
  return (
    e.type === 'StripeInvalidRequestError' &&
    e.code === 'resource_missing' &&
    e.param === 'customer'
  )
}

// ============================================================================
// PAYMENT LINK WITH OVERRIDE
// ============================================================================

const paymentLinkWithOverrideInputSchema = z.object({
  profileId: z.string().uuid('Invalid student ID'),
  overrideAmount: z.number().optional(),
  billingStartDate: z.string().optional(),
})

export interface GeneratePaymentLinkInput {
  profileId: string
  overrideAmount?: number // in cents
  billingStartDate?: string // ISO date string for delayed start
}

export interface PaymentLinkWithOverrideData {
  url: string
  calculatedAmount: number
  finalAmount: number
  isOverride: boolean
  billingPeriod: string
  billingConfig: {
    graduationStatus: GraduationStatus | null
    paymentFrequency: PaymentFrequency | null
    billingType: StudentBillingType | null
  }
  studentName: string
  studentPhone: string | null
}

/**
 * No revalidatePath() needed -- only creates a Stripe checkout session.
 * Subscription/billing updates happen via webhook after payment completion.
 */
const _generatePaymentLinkWithOverrideAction = adminActionClient
  .metadata({ actionName: 'generatePaymentLinkWithOverrideAction' })
  .schema(paymentLinkWithOverrideInputSchema)
  .action(async ({ parsedInput }): Promise<PaymentLinkWithOverrideData> => {
    const { profileId, overrideAmount, billingStartDate } = parsedInput

    // Validate billingStartDate if provided (Zod validation per CLAUDE.md Rule 8)
    if (billingStartDate) {
      const dateResult = BillingStartDateSchema.safeParse(billingStartDate)
      if (!dateResult.success) {
        throw new ActionError(
          dateResult.error.errors[0]?.message || 'Invalid billing start date',
          ERROR_CODES.VALIDATION_ERROR
        )
      }
    }

    // Validate override amount if provided
    if (overrideAmount !== undefined) {
      const amountResult = OverrideAmountSchema.safeParse(overrideAmount)
      if (!amountResult.success) {
        throw new ActionError(
          amountResult.error.errors[0]?.message || 'Invalid override amount',
          ERROR_CODES.VALIDATION_ERROR
        )
      }
    }

    // 1. Fetch profile with billing config and contact info
    const profile = await getProfileForPaymentLink(profileId)

    if (!profile) {
      throw new ActionError('Student profile not found', ERROR_CODES.NOT_FOUND)
    }

    // 2. Validate billing config is complete
    if (
      !profile.graduationStatus ||
      !profile.paymentFrequency ||
      !profile.billingType
    ) {
      throw new ActionError(
        'Billing configuration incomplete. Please set Graduation Status, Payment Frequency, and Billing Type first.',
        ERROR_CODES.VALIDATION_ERROR
      )
    }

    // 3. Check if EXEMPT
    if (profile.billingType === 'EXEMPT') {
      throw new ActionError(
        'Exempt students do not need payment setup.',
        ERROR_CODES.VALIDATION_ERROR
      )
    }

    // 4. Calculate rate
    const calculatedAmount = calculateMahadRate(
      profile.graduationStatus,
      profile.paymentFrequency,
      profile.billingType
    )

    if (calculatedAmount <= 0) {
      throw new ActionError(
        'Invalid rate calculation. Please verify billing configuration.',
        ERROR_CODES.VALIDATION_ERROR
      )
    }

    // 5. Determine final amount (override or calculated)
    const isOverride = overrideAmount !== undefined && overrideAmount > 0
    const finalAmount = isOverride ? overrideAmount : calculatedAmount

    // 6. Validate override amount if provided
    if (isOverride) {
      if (finalAmount <= 0) {
        throw new ActionError(
          'Override amount must be greater than 0',
          ERROR_CODES.VALIDATION_ERROR
        )
      }
      if (finalAmount > MAX_EXPECTED_RATE_CENTS * 2) {
        logger.warn(
          { finalAmount, profileId },
          'Override amount exceeds 2x max expected rate'
        )
      }
    }

    // 7. Validate email exists
    const email = profile.person.email
    const phone = profile.person.phone

    if (!email) {
      throw new ActionError(
        'Student email address is required for payment setup. Please add an email first.',
        ERROR_CODES.VALIDATION_ERROR
      )
    }

    // 8. Guard: block if this profile already has a live subscription in the DB.
    if (await hasLiveMahadSubscription(profileId)) {
      throw new ActionError(
        'This student already has an active Mahad subscription. Cancel it before generating a new link.',
        ERROR_CODES.VALIDATION_ERROR
      )
    }

    // 9. Reuse existing Stripe customer if one exists (avoids duplicate customers after profile deletion)
    const existingCustomerId = await getMahadStripeCustomerId(profile.personId)

    const stripe = getMahadStripeClient()

    // 10. Guard: verify with Stripe directly. The DB guard above cannot see
    // subscriptions whose local records were deleted (post-deletion recovery),
    // but Stripe can — a live subscription there means the family is already
    // paying, so the fix is re-linking it, not a second checkout. Residual gap:
    // if the Person row itself was deleted, BillingAccount cascades away and no
    // customer ID survives to check — that case still needs /admin/link-subscriptions.
    if (existingCustomerId) {
      try {
        const stripeSubscriptions = await stripe.subscriptions.list({
          customer: existingCustomerId,
          limit: 100,
        })
        if (stripeSubscriptions.has_more) {
          throw new ActionError(
            'This customer has too many Stripe subscriptions to verify safely. Review them in the Stripe dashboard before generating a new link.',
            ERROR_CODES.VALIDATION_ERROR
          )
        }
        const liveInStripe = stripeSubscriptions.data.filter((sub) =>
          (LIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(sub.status)
        )
        if (liveInStripe.length > 0) {
          logger.warn(
            {
              profileId,
              existingCustomerId,
              stripeSubscriptionIds: liveInStripe.map((sub) => sub.id),
            },
            'Live Stripe subscription found with no matching DB record'
          )
          throw new ActionError(
            'Stripe already has a live subscription for this student that is not linked in the database. Re-link it via Link Subscriptions or cancel it in Stripe before generating a new link.',
            ERROR_CODES.VALIDATION_ERROR
          )
        }
      } catch (error) {
        if (error instanceof ActionError) throw error
        if (!isStaleStripeCustomer(error)) {
          await logError(
            logger,
            error,
            'Stripe subscription verification failed',
            { profileId, existingCustomerId }
          )
          throw new ActionError(
            'Could not verify existing subscriptions in Stripe. Please try again.',
            ERROR_CODES.SERVER_ERROR
          )
        }
      }
    }

    // 11. Validate app URL configuration
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    if (!appUrl) {
      throw new ActionError(
        'App URL not configured. Please set NEXT_PUBLIC_APP_URL.',
        ERROR_CODES.SERVER_ERROR
      )
    }

    // 12. Get validated product ID
    const { productId } = getMahadKeys()
    if (!productId) {
      throw new ActionError(
        'Stripe product not configured. Please set STRIPE_MAHAD_PRODUCT_ID.',
        ERROR_CODES.SERVER_ERROR
      )
    }

    // 13. Create Stripe checkout session
    const intervalConfig = getStripeInterval(profile.paymentFrequency)

    // Calculate and validate billing_cycle_anchor if start date provided
    let billingCycleAnchor: number | undefined
    if (billingStartDate) {
      const startDate = new Date(billingStartDate)
      billingCycleAnchor = Math.floor(startDate.getTime() / 1000)
      try {
        validateBillingCycleAnchor(billingCycleAnchor)
      } catch (error) {
        logger.warn(
          { billingCycleAnchor, profileId },
          'Invalid billing cycle anchor provided by admin'
        )
        throw new ActionError(
          error instanceof Error ? error.message : 'Invalid billing start date',
          ERROR_CODES.VALIDATION_ERROR
        )
      }
    }

    logger.info(
      {
        profileId,
        billingStartDate: billingStartDate || 'immediate',
        billingCycleAnchor: billingCycleAnchor
          ? new Date(billingCycleAnchor * 1000).toISOString()
          : 'none',
        finalAmount: finalAmount / 100,
        isOverride,
        reusedCustomer: !!existingCustomerId,
      },
      'Creating payment link with billing config'
    )

    const sessionParams = {
      mode: 'subscription' as const,
      payment_method_types: (featureFlags.mahadCardPayments()
        ? ['card', 'us_bank_account']
        : ['us_bank_account']) as ('card' | 'us_bank_account')[],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product: productId,
            unit_amount: finalAmount,
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
          profileId: profile.id,
          personId: profile.personId,
          studentName: profile.person.name,
          graduationStatus: profile.graduationStatus,
          paymentFrequency: profile.paymentFrequency,
          billingType: profile.billingType,
          calculatedRate: calculatedAmount.toString(),
          finalRate: finalAmount.toString(),
          isOverride: isOverride.toString(),
          billingStartDate: billingStartDate || 'immediate',
          source: 'admin-generated-link',
        },
      },
      metadata: {
        profileId: profile.id,
        personId: profile.personId,
        studentName: profile.person.name,
        source: 'admin-generated-link',
      },
      success_url: `${appUrl}/mahad/payment-complete?payment=success`,
      cancel_url: `${appUrl}/mahad/payment-complete?payment=canceled`,
      allow_promotion_codes: true,
    }

    let session: Awaited<ReturnType<typeof stripe.checkout.sessions.create>>
    try {
      session = await stripe.checkout.sessions.create({
        ...sessionParams,
        ...(existingCustomerId
          ? { customer: existingCustomerId }
          : { customer_email: email }),
      })
    } catch (error) {
      if (existingCustomerId && isStaleStripeCustomer(error)) {
        logger.warn(
          { existingCustomerId, profileId },
          'Stored Stripe customer ID is stale — retrying with customer_email'
        )
        session = await stripe.checkout.sessions.create({
          ...sessionParams,
          customer_email: email,
        })
      } else {
        await logError(
          logger,
          error,
          'Stripe checkout session creation failed',
          {
            profileId,
            finalAmount,
          }
        )
        throw new ActionError(
          'Failed to create payment session. Please try again.',
          ERROR_CODES.SERVER_ERROR
        )
      }
    }

    const billingPeriod =
      profile.paymentFrequency === 'BI_MONTHLY' ? '/2 months' : '/month'

    if (!session.url) {
      throw new ActionError(
        'Failed to generate checkout URL. Please try again.',
        ERROR_CODES.SERVER_ERROR
      )
    }

    return {
      url: session.url,
      calculatedAmount,
      finalAmount,
      isOverride,
      billingPeriod,
      billingConfig: {
        graduationStatus: profile.graduationStatus,
        paymentFrequency: profile.paymentFrequency,
        billingType: profile.billingType,
      },
      studentName: profile.person.name,
      studentPhone: phone,
    }
  })

export async function generatePaymentLinkWithOverrideAction(
  ...args: Parameters<typeof _generatePaymentLinkWithOverrideAction>
) {
  return _generatePaymentLinkWithOverrideAction(...args)
}
