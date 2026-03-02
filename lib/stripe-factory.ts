import Stripe from 'stripe'

import type { StripeProgramConfig } from '@/lib/keys/stripe'
import { createServiceLogger } from '@/lib/logger'

export function createStripeService(
  name: string,
  getKeys: () => StripeProgramConfig
) {
  const logger = createServiceLogger(`stripe-${name}`)
  let client: Stripe | null = null

  function getClient(): Stripe {
    if (!client) {
      const { secretKey } = getKeys()
      logger.info(`Initializing ${name} Stripe client`)
      client = new Stripe(secretKey, {
        apiVersion: '2025-08-27.basil',
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
      logger.error(
        { err, signaturePreview: signature.substring(0, 20) + '...' },
        `${name} webhook verification failed`
      )
      throw err
    }
  }

  return { getClient, getWebhookSecret, verifyWebhook }
}
