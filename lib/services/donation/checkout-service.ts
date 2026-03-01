import type Stripe from 'stripe'

import { getDonationKeys } from '@/lib/keys/stripe'
import { createServiceLogger } from '@/lib/logger'
import { getDonationStripeClient } from '@/lib/stripe-donation'
import { type DonationCheckoutInput } from '@/lib/validations/donation'

const logger = createServiceLogger('donation-checkout')

export async function createDonationCheckoutSession(
  input: DonationCheckoutInput
): Promise<Stripe.Checkout.Session> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    throw new Error('NEXT_PUBLIC_APP_URL is not configured')
  }

  const stripe = getDonationStripeClient()
  const donationKeys = getDonationKeys()
  const isRecurring = input.mode === 'subscription'

  const metadata: Record<string, string> = {
    source: 'donation_page',
    isAnonymous: String(input.isAnonymous),
  }
  if (input.donorName) metadata.donorName = input.donorName

  const priceData: Stripe.Checkout.SessionCreateParams.LineItem.PriceData = {
    currency: 'usd',
    unit_amount: input.amount,
    ...(isRecurring && { recurring: { interval: 'month' as const } }),
  }

  if (donationKeys.productId) {
    priceData.product = donationKeys.productId
  } else {
    const label = isRecurring ? 'Monthly Donation' : 'Donation'
    priceData.product_data = { name: `${label} to Irshad Center` }
  }

  const session = await stripe.checkout.sessions.create({
    mode: input.mode,
    payment_method_types: ['card'],
    success_url: `${appUrl}/donate/thank-you?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/donate?canceled=true`,
    customer_email: input.donorEmail,
    metadata,
    line_items: [{ price_data: priceData, quantity: 1 }],
  })

  logger.info(
    { sessionId: session.id, mode: input.mode, amount: input.amount },
    'Donation checkout session created'
  )

  return session
}
