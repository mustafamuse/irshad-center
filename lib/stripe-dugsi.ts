import { getDugsiKeys } from '@/lib/keys/stripe'
import { createStripeService } from '@/lib/stripe-factory'

const service = createStripeService('dugsi', getDugsiKeys)

export const getDugsiStripeClient = service.getClient
export const getDugsiWebhookSecret = service.getWebhookSecret
export const verifyDugsiWebhook = service.verifyWebhook
