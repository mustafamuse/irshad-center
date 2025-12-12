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
