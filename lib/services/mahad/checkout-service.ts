/**
 * Mahad Checkout Service
 *
 * Business logic for Mahad checkout and payment setup.
 * Handles Stripe checkout session creation with proper configuration.
 *
 * Responsibilities:
 * - Create Stripe checkout sessions with dynamic pricing
 * - Configure subscription metadata for webhook processing
 * - Handle existing customer lookup
 */

import type {
  GraduationStatus,
  PaymentFrequency,
  StudentBillingType,
} from '@prisma/client'

import { prisma } from '@/lib/db'
import { getMahadKeys } from '@/lib/keys/stripe'
import { createServiceLogger, logError } from '@/lib/logger'
import { getMahadStripeClient } from '@/lib/stripe-mahad'
import {
  formatBillingType,
  formatGraduationStatus,
  formatRateDisplay,
  getStripeInterval,
} from '@/lib/utils/mahad-tuition'

const logger = createServiceLogger('mahad-checkout')

/**
 * Parameters for creating a checkout session
 */
export interface CreateCheckoutSessionParams {
  profile: {
    id: string
    personId: string
    person: {
      name: string
    }
  }
  email: string
  graduationStatus: GraduationStatus
  paymentFrequency: PaymentFrequency
  billingType: StudentBillingType
  rateInCents: number
  successUrl: string
  cancelUrl: string
}

/**
 * Result of checkout session creation
 */
export interface CheckoutSessionResult {
  sessionId: string
  url: string | null
}

/**
 * Create a Stripe checkout session for Mahad tuition payment
 *
 * @param params - Checkout session parameters
 * @returns Checkout session ID and URL
 */
export async function createMahadCheckoutSession(
  params: CreateCheckoutSessionParams
): Promise<CheckoutSessionResult> {
  const {
    profile,
    email,
    graduationStatus,
    paymentFrequency,
    billingType,
    rateInCents,
    successUrl,
    cancelUrl,
  } = params

  const stripe = getMahadStripeClient()

  const { productId } = getMahadKeys()
  if (!productId) {
    await logError(
      logger,
      new Error('STRIPE_MAHAD_PRODUCT_ID not configured'),
      'Stripe product not configured',
      { profileId: profile.id }
    )
    throw new Error('Payment system not properly configured')
  }

  const intervalConfig = getStripeInterval(paymentFrequency)

  let customerId: string | undefined
  const existingBillingAccount = await prisma.billingAccount.findFirst({
    where: { personId: profile.personId },
    select: { stripeCustomerIdMahad: true },
  })

  if (existingBillingAccount?.stripeCustomerIdMahad) {
    customerId = existingBillingAccount.stripeCustomerIdMahad
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['us_bank_account'],
    customer: customerId,
    customer_email: customerId ? undefined : email,
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
      metadata: {
        Student: profile.person.name,
        Rate: formatRateDisplay(rateInCents, paymentFrequency),
        Status: formatGraduationStatus(graduationStatus),
        Type: formatBillingType(billingType),
        Source: 'Mahad Registration',
        profileId: profile.id,
        personId: profile.personId,
        studentName: profile.person.name,
        graduationStatus,
        paymentFrequency,
        billingType,
        calculatedRate: rateInCents.toString(),
        source: 'mahad-registration',
      },
    },
    metadata: {
      Student: profile.person.name,
      Source: 'Mahad Registration',
      profileId: profile.id,
      personId: profile.personId,
      studentName: profile.person.name,
      source: 'mahad-registration',
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
  })

  logger.info(
    {
      profileId: profile.id,
      studentName: profile.person.name,
      graduationStatus,
      paymentFrequency,
      billingType,
      calculatedRate: rateInCents,
      sessionId: session.id,
    },
    'Checkout session created'
  )

  return {
    sessionId: session.id,
    url: session.url,
  }
}
