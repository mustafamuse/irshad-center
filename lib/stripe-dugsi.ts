/**
 * Dugsi-specific Stripe Service
 *
 * This service handles all Stripe operations for the Dugsi program,
 * using a completely separate Stripe account from the Mahad program.
 * This ensures complete isolation between the two payment systems.
 */

import Stripe from 'stripe'

import { getDugsiKeys } from '@/lib/keys/stripe'
import { createServiceLogger } from '@/lib/logger'
import { isValidEmail } from '@/lib/utils/type-guards'

const logger = createServiceLogger('stripe-dugsi')

let dugsiStripeClient: Stripe | null = null

/**
 * Get the Dugsi-specific Stripe client.
 * Uses centralized keys from lib/keys/stripe.ts which auto-switches test/live.
 */
export function getDugsiStripeClient(): Stripe {
  const { secretKey } = getDugsiKeys()

  if (!dugsiStripeClient) {
    logger.info('Initializing Dugsi Stripe client')
    dugsiStripeClient = new Stripe(secretKey, {
      apiVersion: '2025-08-27.basil',
      typescript: true,
    })
  }

  return dugsiStripeClient
}

/**
 * Construct a payment URL for Dugsi registration.
 * This creates a URL to the Stripe payment link with metadata
 * for tracking the family and number of children.
 *
 * @param params - The parameters for constructing the payment URL
 * @returns The complete payment URL with query parameters
 */
export function constructDugsiPaymentUrl(params: {
  parentEmail: string
  familyId: string
  childCount: number
}): string {
  // Validate inputs
  if (!params.parentEmail || typeof params.parentEmail !== 'string') {
    throw new Error('Parent email is required and must be a string')
  }

  // Use improved email validation
  if (!isValidEmail(params.parentEmail)) {
    throw new Error('Invalid parent email format')
  }

  if (!params.familyId || typeof params.familyId !== 'string') {
    throw new Error('Family ID is required and must be a string')
  }

  if (!params.childCount || typeof params.childCount !== 'number') {
    throw new Error('Child count is required and must be a number')
  }

  if (params.childCount < 1 || params.childCount > 20) {
    throw new Error('Child count must be between 1 and 20')
  }

  if (!Number.isInteger(params.childCount)) {
    throw new Error('Child count must be a whole number')
  }

  const { paymentLink } = getDugsiKeys()

  if (!paymentLink) {
    throw new Error(
      'Dugsi payment link not configured. Please set NEXT_PUBLIC_STRIPE_DUGSI_PAYMENT_LINK in your environment variables.'
    )
  }

  const baseUrl = paymentLink

  const url = new URL(baseUrl)

  // Add metadata for tracking
  url.searchParams.set('prefilled_email', params.parentEmail)

  // Create a reference ID that includes family ID and child count
  const referenceId = `dugsi_${params.familyId}_${params.childCount}kid${
    params.childCount > 1 ? 's' : ''
  }`
  url.searchParams.set('client_reference_id', referenceId)

  return url.toString()
}

/**
 * Get the Dugsi webhook secret for verifying webhook signatures.
 * Uses centralized keys from lib/keys/stripe.ts.
 */
export function getDugsiWebhookSecret(): string {
  const { webhookSecret } = getDugsiKeys()
  return webhookSecret
}

/**
 * Verify a Dugsi webhook event.
 *
 * @param body - The raw request body
 * @param signature - The stripe-signature header
 * @returns The verified Stripe event
 */
export function verifyDugsiWebhook(
  body: string,
  signature: string
): Stripe.Event {
  const dugsiClient = getDugsiStripeClient()
  const webhookSecret = getDugsiWebhookSecret()

  try {
    return dugsiClient.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    const error = err as Error
    logger.error(
      { err: error, signaturePreview: signature.substring(0, 20) + '...' },
      'Dugsi webhook verification failed'
    )
    throw new Error(`Webhook verification failed: ${error.message}`)
  }
}

/**
 * Test Dugsi Stripe client initialization.
 * This can be called during app startup to verify configuration.
 */
export async function testDugsiStripeClientInitialization(): Promise<void> {
  try {
    const client = getDugsiStripeClient()
    await client.customers.list({ limit: 1 })
    logger.info('Dugsi Stripe client initialized successfully')
  } catch (error) {
    logger.error({ error }, 'Dugsi Stripe client initialization failed')
    throw error
  }
}
