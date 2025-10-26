/**
 * Dugsi Webhook Handler
 *
 * This endpoint handles webhook events from the Dugsi Stripe account.
 * It's completely separate from the Mahad webhook handler to ensure
 * proper isolation between the two payment systems.
 */

import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

import type Stripe from 'stripe'

import { prisma } from '@/lib/db'
import { verifyDugsiWebhook } from '@/lib/stripe-dugsi'
import { parseDugsiReferenceId } from '@/lib/utils/dugsi-payment'
import {
  extractCustomerId,
  extractPeriodEnd,
  isValidSubscriptionStatus,
} from '@/lib/utils/type-guards'

/**
 * Handle successful payment method capture (checkout.session.completed).
 * This happens when a parent completes the $1 payment to save their payment method.
 */
async function handlePaymentMethodCaptured(
  session: Stripe.Checkout.Session
): Promise<void> {
  const { client_reference_id, customer, customer_email } = session

  console.log('💳 Processing Dugsi payment method capture:', {
    referenceId: client_reference_id,
    customer,
    email: customer_email,
  })

  // Parse the reference ID to get family information
  if (!client_reference_id) {
    throw new Error('No client_reference_id in checkout session')
  }

  const parsed = parseDugsiReferenceId(client_reference_id)
  if (!parsed) {
    throw new Error(`Invalid reference ID format: ${client_reference_id}`)
  }

  const { familyId } = parsed

  // Validate customer ID exists
  if (!customer || typeof customer !== 'string') {
    throw new Error('Invalid or missing customer ID in checkout session')
  }

  try {
    // Use transaction for atomic updates
    await prisma.$transaction(async (tx) => {
      // Update all students in the family with the Stripe customer ID
      const updateResult = await tx.student.updateMany({
        where: {
          familyReferenceId: familyId,
          program: 'DUGSI_PROGRAM',
        },
        data: {
          stripeCustomerIdDugsi: customer,
          paymentMethodCaptured: true,
          paymentMethodCapturedAt: new Date(),
          stripeAccountType: 'DUGSI',
        },
      })

      if (updateResult.count === 0) {
        throw new Error(`No students found for family ${familyId}`)
      }

      console.log(
        `✅ Updated ${updateResult.count} students with payment method for family ${familyId}`
      )
    })
  } catch (error) {
    console.error('❌ Error updating student records:', error)
    throw error
  }
}

/**
 * Handle subscription creation/update from manual Stripe dashboard actions.
 * This allows admins to manually create subscriptions and have them linked back.
 */
async function handleSubscriptionEvent(
  subscription: Stripe.Subscription
): Promise<void> {
  // Validate and extract customer ID using type guard
  const customerId = extractCustomerId(subscription.customer)

  if (!customerId) {
    throw new Error('Invalid or missing customer ID in subscription')
  }

  const subscriptionId = subscription.id

  console.log('📊 Processing Dugsi subscription event:', {
    customerId,
    subscriptionId,
    status: subscription.status,
  })

  try {
    await prisma.$transaction(async (tx) => {
      // Find all students with this Stripe customer ID
      const students = await tx.student.findMany({
        where: {
          stripeCustomerIdDugsi: customerId,
          program: 'DUGSI_PROGRAM',
        },
      })

      if (students.length === 0) {
        throw new Error(`No students found for customer: ${customerId}`)
      }

      // Validate subscription status using type guard
      if (!isValidSubscriptionStatus(subscription.status)) {
        throw new Error(`Invalid subscription status: ${subscription.status}`)
      }

      // Update all students in the family with the subscription
      const studentIds = students.map((s) => s.id)
      const updateResult = await tx.student.updateMany({
        where: {
          id: { in: studentIds },
        },
        data: {
          stripeSubscriptionIdDugsi: subscriptionId,
          subscriptionStatus: subscription.status,
          paidUntil: extractPeriodEnd(subscription),
        },
      })

      if (updateResult.count === 0) {
        throw new Error('Failed to update students with subscription')
      }

      console.log(
        `✅ Updated ${updateResult.count} students with subscription ${subscriptionId}`
      )
    })
  } catch (error) {
    console.error('❌ Error handling subscription event:', error)
    throw error
  }
}

/**
 * Main webhook handler for Dugsi Stripe events.
 */
export async function POST(req: Request) {
  let eventId: string | undefined

  try {
    const body = await req.text()
    const headersList = await headers()
    const signature = headersList.get('stripe-signature')

    if (!signature) {
      console.error('❌ Missing Dugsi webhook signature')
      return NextResponse.json(
        { message: 'Missing signature' },
        { status: 400 }
      )
    }

    // Verify the webhook using Dugsi-specific secret
    const event = verifyDugsiWebhook(body, signature)
    eventId = event.id

    console.log(`🔔 Dugsi webhook received: ${event.type} (${eventId})`)

    // Check for idempotency - prevent processing the same event twice
    const existingEvent = await prisma.webhookEvent.findUnique({
      where: {
        eventId_source: {
          eventId: event.id,
          source: 'dugsi',
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

    // Record the event to prevent duplicate processing
    await prisma.webhookEvent.create({
      data: {
        eventId: event.id,
        eventType: event.type,
        source: 'dugsi',
        payload: JSON.parse(body),
      },
    })

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed':
        await handlePaymentMethodCaptured(
          event.data.object as Stripe.Checkout.Session
        )
        break

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionEvent(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.deleted':
        // Handle subscription cancellation
        const canceledSub = event.data.object as Stripe.Subscription
        const canceledCustomerId = extractCustomerId(canceledSub.customer)

        if (!canceledCustomerId) {
          throw new Error('Invalid customer ID in canceled subscription')
        }

        const cancelResult = await prisma.student.updateMany({
          where: {
            stripeCustomerIdDugsi: canceledCustomerId,
            program: 'DUGSI_PROGRAM',
          },
          data: {
            subscriptionStatus: 'canceled',
          },
        })

        if (cancelResult.count === 0) {
          console.warn(
            `⚠️ No students found to cancel for customer: ${canceledCustomerId}`
          )
        }
        break

      default:
        console.log(`⚠️ Unhandled Dugsi event type: ${event.type}`)
    }

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    console.error(`❌ Dugsi Webhook Error: ${errorMessage}`)

    // If we have an eventId and the error isn't about duplicate processing,
    // we should clean up the webhook event record so it can be retried
    if (eventId && !errorMessage.includes('already processed')) {
      try {
        await prisma.webhookEvent.delete({
          where: {
            eventId_source: {
              eventId,
              source: 'dugsi',
            },
          },
        })
      } catch (deleteErr) {
        // Ignore delete errors
      }
    }

    // Return appropriate status codes based on error type
    if (
      errorMessage.includes('Missing signature') ||
      errorMessage.includes('verification failed')
    ) {
      return NextResponse.json(
        { message: 'Invalid webhook signature' },
        { status: 401 }
      )
    }

    if (
      errorMessage.includes('No students found') ||
      errorMessage.includes('Invalid reference ID')
    ) {
      // These are data issues, not webhook failures
      // Return 200 to prevent Stripe from retrying
      console.warn('Data issue, returning 200 to prevent retry:', errorMessage)
      return NextResponse.json(
        { received: true, warning: errorMessage },
        { status: 200 }
      )
    }

    // For other errors, return 500 to trigger Stripe retry
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Force dynamic rendering
export const dynamic = 'force-dynamic'
