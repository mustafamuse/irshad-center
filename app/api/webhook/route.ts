import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

import type { Prisma } from '@prisma/client'

import { STRIPE_WEBHOOK_EVENTS } from '@/lib/constants/stripe'
import { prisma } from '@/lib/db'
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
  [STRIPE_WEBHOOK_EVENTS.CHECKOUT_COMPLETED]: handleCheckoutSessionCompleted,
  [STRIPE_WEBHOOK_EVENTS.INVOICE_PAYMENT_SUCCEEDED]: handleInvoicePaymentSucceeded,
  [STRIPE_WEBHOOK_EVENTS.INVOICE_PAYMENT_FAILED]: handleInvoicePaymentFailed,
  [STRIPE_WEBHOOK_EVENTS.SUBSCRIPTION_UPDATED]: handleSubscriptionUpdated,
  [STRIPE_WEBHOOK_EVENTS.SUBSCRIPTION_DELETED]: handleSubscriptionDeleted,
}

export async function POST(req: Request) {
  let eventId: string | undefined

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

    eventId = event.id

    console.log(`🔔 Mahad webhook received: ${event.type} (${eventId})`)

    // Check for idempotency - prevent processing the same event twice
    const existingEvent = await prisma.webhookEvent.findUnique({
      where: {
        eventId_source: {
          eventId: event.id,
          source: 'mahad',
        },
      },
    })

    if (existingEvent) {
      console.log(`⚠️ Event ${event.id} already processed, skipping`)
      return NextResponse.json(
        { received: true, skipped: true },
        { status: 200 }
      )
    }

    // Parse JSON payload safely
    let payload: Prisma.InputJsonValue
    try {
      payload = JSON.parse(body) as Prisma.InputJsonValue
    } catch (parseError) {
      console.error('❌ Failed to parse webhook body as JSON:', parseError)
      return NextResponse.json(
        { message: 'Invalid JSON payload' },
        { status: 400 }
      )
    }

    // Record the event to prevent duplicate processing
    await prisma.webhookEvent.create({
      data: {
        eventId: event.id,
        eventType: event.type,
        source: 'mahad',
        payload: payload,
      },
    })

    // Process the event
    const handler = eventHandlers[event.type as keyof typeof eventHandlers]
    if (handler) {
      await handler(event)
      console.log(`✅ Successfully processed ${event.type}`)
    } else {
      console.log(`⚠️ Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    console.error(`❌ Mahad Webhook Error: ${errorMessage}`)

    // If we have an eventId and the error isn't about duplicate processing,
    // we should clean up the webhook event record so it can be retried
    if (eventId && !errorMessage.includes('already processed')) {
      try {
        await prisma.webhookEvent.delete({
          where: {
            eventId_source: {
              eventId,
              source: 'mahad',
            },
          },
        })
      } catch (deleteErr) {
        // Ignore delete errors
      }
    }

    return NextResponse.json(
      { message: `Webhook Error: ${errorMessage}` },
      { status: 400 }
    )
  }
}

export const dynamic = 'force-dynamic'
