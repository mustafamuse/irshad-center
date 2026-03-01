import Stripe from 'stripe'

import { getDonationKeys } from '@/lib/keys/stripe'
import { createServiceLogger } from '@/lib/logger'

const logger = createServiceLogger('stripe-donation')

let donationStripeClient: Stripe | null = null

export function getDonationStripeClient(): Stripe {
  const { secretKey } = getDonationKeys()

  if (!donationStripeClient) {
    logger.info('Initializing Donation Stripe client')
    donationStripeClient = new Stripe(secretKey, {
      apiVersion: '2025-08-27.basil',
      typescript: true,
    })
  }

  return donationStripeClient
}

export function getDonationWebhookSecret(): string {
  const { webhookSecret } = getDonationKeys()
  return webhookSecret
}

export function verifyDonationWebhook(
  body: string,
  signature: string
): Stripe.Event {
  const client = getDonationStripeClient()
  const webhookSecret = getDonationWebhookSecret()

  try {
    return client.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    logger.error(
      { err, signaturePreview: signature.substring(0, 20) + '...' },
      'Donation webhook verification failed'
    )
    throw err
  }
}
