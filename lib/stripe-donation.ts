import { getDonationKeys } from '@/lib/keys/stripe'
import { createStripeService } from '@/lib/stripe-factory'

const service = createStripeService('donation', getDonationKeys)

export const getDonationStripeClient = service.getClient
export const getDonationWebhookSecret = service.getWebhookSecret
export const verifyDonationWebhook = service.verifyWebhook
