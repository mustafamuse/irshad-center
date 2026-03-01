import Stripe from 'stripe'

import type { StripeProgramConfig } from '@/lib/keys/stripe'
import { createServiceLogger } from '@/lib/logger'

const STRIPE_API_VERSION = '2025-08-27.basil'

interface StripeService {
  getClient: () => Stripe
  getWebhookSecret: () => string
  verifyWebhook: (body: string, signature: string) => Stripe.Event
}

export function createStripeService(
  name: string,
  getKeys: () => StripeProgramConfig
): StripeService {
  const logger = createServiceLogger(`stripe-${name}`)
  let client: Stripe | null = null

  function getClient(): Stripe {
    if (!client) {
      const { secretKey } = getKeys()
      logger.info(`Initializing ${name} Stripe client`)
      client = new Stripe(secretKey, {
        apiVersion: STRIPE_API_VERSION,
        typescript: true,
      })
    }
    return client
  }

  function getWebhookSecret(): string {
    const { webhookSecret } = getKeys()
    return webhookSecret
  }

  function verifyWebhook(body: string, signature: string): Stripe.Event {
    try {
      return getClient().webhooks.constructEvent(
        body,
        signature,
        getWebhookSecret()
      )
    } catch (err) {
      const error = err as Error
      logger.error(
        { err: error, signaturePreview: signature.substring(0, 20) + '...' },
        `${name} webhook verification failed`
      )
      throw new Error(`Webhook verification failed: ${error.message}`)
    }
  }

  return { getClient, getWebhookSecret, verifyWebhook }
}
