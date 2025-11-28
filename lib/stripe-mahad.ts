/**
 * Mahad Stripe Service
 *
 * This service handles all Stripe operations for the Mahad program
 * and other programs using the main Stripe account.
 */

import Stripe from 'stripe'

import { getMahadKeys } from '@/lib/keys/stripe'
import { createServiceLogger } from '@/lib/logger'

const logger = createServiceLogger('stripe-mahad')

let mahadStripeClient: Stripe | null = null

/**
 * Get the Mahad Stripe client.
 * Uses centralized keys from lib/keys/stripe.ts which auto-switches test/live.
 *
 * @returns Stripe client instance
 */
export function getMahadStripeClient(): Stripe {
  const { secretKey } = getMahadKeys()

  if (!mahadStripeClient) {
    logger.info('Initializing Mahad Stripe client')
    mahadStripeClient = new Stripe(secretKey, {
      apiVersion: '2025-08-27.basil',
      typescript: true,
    })
  }

  return mahadStripeClient
}

/**
 * Get the Mahad webhook secret for verifying webhook signatures.
 * Uses centralized keys from lib/keys/stripe.ts.
 */
export function getMahadWebhookSecret(): string {
  const { webhookSecret } = getMahadKeys()
  return webhookSecret
}

/**
 * Verify a Mahad webhook event.
 *
 * @param body - The raw request body
 * @param signature - The stripe-signature header
 * @returns The verified Stripe event
 */
export function verifyMahadWebhook(
  body: string,
  signature: string
): Stripe.Event {
  const mahadClient = getMahadStripeClient()
  const webhookSecret = getMahadWebhookSecret()

  try {
    return mahadClient.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    const error = err as Error
    logger.error(
      {
        err: error,
        signaturePreview: signature.substring(0, 20) + '...',
      },
      'Mahad webhook verification failed'
    )
    throw new Error(`Webhook verification failed: ${error.message}`)
  }
}

/**
 * Legacy export for backward compatibility.
 * @deprecated Use getMahadStripeClient() instead
 */
export const stripeServerClient = new Proxy({} as Stripe, {
  get: (target, prop) => {
    const client = getMahadStripeClient()
    const value = client[prop as keyof Stripe]
    if (typeof value === 'function') {
      return value.bind(client)
    }
    return value
  },
})
