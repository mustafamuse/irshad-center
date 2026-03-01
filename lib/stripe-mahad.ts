import Stripe from 'stripe'

import { getMahadKeys } from '@/lib/keys/stripe'
import { createStripeService } from '@/lib/stripe-factory'

const service = createStripeService('mahad', getMahadKeys)

export const getMahadStripeClient = service.getClient
export const getMahadWebhookSecret = service.getWebhookSecret
export const verifyMahadWebhook = service.verifyWebhook

/** @deprecated Use getMahadStripeClient() instead */
export const stripeServerClient = new Proxy({} as Stripe, {
  get: (_target, prop) => {
    const client = getMahadStripeClient()
    const value = client[prop as keyof Stripe]
    if (typeof value === 'function') {
      return value.bind(client)
    }
    return value
  },
})
