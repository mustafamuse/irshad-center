/**
 * Mahad Stripe Service
 *
 * This service handles all Stripe operations for the Mahad program
 * and other programs using the main Stripe account.
 */

import Stripe from 'stripe'

import { createServiceLogger } from '@/lib/logger'

const logger = createServiceLogger('stripe-mahad')

let mahadStripeClient: Stripe | null = null

/**
 * Get the Mahad Stripe client.
 * Uses environment-specific API keys (DEV/PROD).
 *
 * @returns Stripe client instance
 */
export function getMahadStripeClient(): Stripe {
  const stripeKey =
    process.env.NODE_ENV === 'production'
      ? process.env.STRIPE_SECRET_KEY_PROD
      : process.env.STRIPE_SECRET_KEY_DEV

  if (!stripeKey) {
    throw new Error(
      'Mahad Stripe key not configured. Please set STRIPE_SECRET_KEY_DEV and STRIPE_SECRET_KEY_PROD in your environment variables.'
    )
  }

  if (!mahadStripeClient) {
    logger.info('Initializing Mahad Stripe client')
    mahadStripeClient = new Stripe(stripeKey, {
      apiVersion: '2025-08-27.basil',
      typescript: true,
    })
  }

  return mahadStripeClient
}

/**
 * Get the Mahad webhook secret for verifying webhook signatures.
 * Uses environment-specific webhook secrets (DEV/PROD).
 */
export function getMahadWebhookSecret(): string {
  const webhookSecret =
    process.env.NODE_ENV === 'production'
      ? process.env.STRIPE_WEBHOOK_SECRET_PROD
      : process.env.STRIPE_WEBHOOK_SECRET_DEV

  if (!webhookSecret) {
    throw new Error(
      'Mahad webhook secret not configured. Please set STRIPE_WEBHOOK_SECRET_DEV and STRIPE_WEBHOOK_SECRET_PROD in your environment variables.'
    )
  }

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
