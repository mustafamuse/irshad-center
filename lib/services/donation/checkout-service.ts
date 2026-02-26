import type Stripe from 'stripe'

import { getDonationKeys } from '@/lib/keys/stripe'
import { createServiceLogger } from '@/lib/logger'
import { getDonationStripeClient } from '@/lib/stripe-donation'
import {
  DonationCheckoutSchema,
  type DonationCheckoutInput,
} from '@/lib/validations/donation'

const logger = createServiceLogger('donation-checkout')

export async function createDonationCheckoutSession(
  input: DonationCheckoutInput
): Promise<Stripe.Checkout.Session> {
  const validated = DonationCheckoutSchema.parse(input)

  const stripe = getDonationStripeClient()
  const donationKeys = getDonationKeys()

  const metadata: Record<string, string> = {
    source: 'donation_page',
    isAnonymous: String(validated.isAnonymous),
  }
  if (validated.donorName) metadata.donorName = validated.donorName

  const baseParams: Stripe.Checkout.SessionCreateParams = {
    payment_method_types: ['card'],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/donate/thank-you?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/donate?canceled=true`,
    metadata,
  }

  if (validated.donorEmail) {
    baseParams.customer_email = validated.donorEmail
  }

  let sessionParams: Stripe.Checkout.SessionCreateParams

  if (validated.mode === 'payment') {
    sessionParams = {
      ...baseParams,
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: validated.amount,
            product: donationKeys.productId || undefined,
            ...(!donationKeys.productId && {
              product_data: { name: 'Donation to Irshad Center' },
            }),
          },
          quantity: 1,
        },
      ],
    }
  } else {
    sessionParams = {
      ...baseParams,
      mode: 'subscription',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: validated.amount,
            recurring: { interval: 'month' },
            product: donationKeys.productId || undefined,
            ...(!donationKeys.productId && {
              product_data: { name: 'Monthly Donation to Irshad Center' },
            }),
          },
          quantity: 1,
        },
      ],
    }
  }

  const session = await stripe.checkout.sessions.create(sessionParams)

  logger.info(
    {
      sessionId: session.id,
      mode: validated.mode,
      amount: validated.amount,
    },
    'Donation checkout session created'
  )

  return session
}
