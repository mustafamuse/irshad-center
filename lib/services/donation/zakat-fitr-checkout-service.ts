import type Stripe from 'stripe'

import { createServiceLogger } from '@/lib/logger'
import { getDonationStripeClient } from '@/lib/stripe-donation'
import {
  ZAKAT_FITR_PER_PERSON_CENTS,
  calculateStripeFee,
  type ZakatFitrCheckoutInput,
} from '@/lib/validations/zakat-fitr'

const logger = createServiceLogger('zakat-fitr-checkout')

function getProductId(): string {
  const productId = process.env.STRIPE_ZAKAT_FITR_PRODUCT_ID
  if (!productId) {
    throw new Error(
      'STRIPE_ZAKAT_FITR_PRODUCT_ID is not configured. Run: npx tsx scripts/create-zakat-fitr-product.ts'
    )
  }
  return productId
}

export async function createZakatFitrCheckoutSession(
  input: ZakatFitrCheckoutInput
): Promise<Stripe.Checkout.Session> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    throw new Error('NEXT_PUBLIC_APP_URL is not configured')
  }

  const stripe = getDonationStripeClient()
  const productId = getProductId()

  const baseCents = input.numberOfPeople * ZAKAT_FITR_PER_PERSON_CENTS
  const { totalCents } = calculateStripeFee(baseCents)

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    phone_number_collection: { enabled: true },
    success_url: `${appUrl}/zakat-fitr/thank-you?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/zakat-fitr`,
    customer_email: input.donorEmail,
    metadata: {
      source: 'zakat_fitr',
      numberOfPeople: String(input.numberOfPeople),
      perPersonCents: String(ZAKAT_FITR_PER_PERSON_CENTS),
    },
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product: productId,
          unit_amount: totalCents,
        },
        quantity: 1,
      },
    ],
  })

  logger.info(
    {
      sessionId: session.id,
      numberOfPeople: input.numberOfPeople,
      baseCents,
      totalCents,
    },
    'Zakat al-Fitr checkout session created'
  )

  return session
}
