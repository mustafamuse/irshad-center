import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

import { stripeServerClient } from '@/lib/stripe'

import {
  handleCheckoutSessionCompleted,
  handleInvoicePaymentSucceeded,
  handleSubscriptionDeleted,
  handleSubscriptionUpdated,
  handleInvoicePaymentFailed,
} from './student-event-handlers'

// Map event types to our new handler functions
const eventHandlers = {
  'checkout.session.completed': handleCheckoutSessionCompleted,
  'invoice.payment_succeeded': handleInvoicePaymentSucceeded,
  'invoice.payment_failed': handleInvoicePaymentFailed,
  'customer.subscription.updated': handleSubscriptionUpdated,
  'customer.subscription.deleted': handleSubscriptionDeleted,
}

export async function POST(req: Request) {
  try {
    const body = await req.text()
    const headersList = await headers()
    const signature = headersList.get('stripe-signature')

    // Get environment-specific webhook secret
    const webhookSecret =
      process.env.NODE_ENV === 'production'
        ? process.env.STRIPE_WEBHOOK_SECRET_PROD
        : process.env.STRIPE_WEBHOOK_SECRET_DEV

    // Early return if no signature or webhook secret
    if (!signature || !webhookSecret) {
      console.error('❌ Missing webhook signature or secret')
      return NextResponse.json(
        { message: 'Missing signature or webhook secret' },
        { status: 400 }
      )
    }

    const event = stripeServerClient.webhooks.constructEvent(
      body,
      signature,
      webhookSecret // Use the environment-specific secret here
    )

    console.log(`✅ Webhook verified: ${event.id}`)

    // Process the event
    const handler = eventHandlers[event.type as keyof typeof eventHandlers]
    if (handler) {
      await handler(event)
      console.log(`✅ Successfully processed ${event.type}`)
    } else {
      console.log(`⚠️ Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ message: 'Processed' }, { status: 200 })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    console.error(`❌ Webhook Error: ${errorMessage}`)
    return NextResponse.json(
      { message: `Webhook Error: ${errorMessage}` },
      { status: 400 }
    )
  }
}

export const dynamic = 'force-dynamic'