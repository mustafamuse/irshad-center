/**
 * Dugsi Webhook Handler
 *
 * This endpoint handles webhook events from the Dugsi Stripe account.
 * It's completely separate from the Mahad webhook handler to ensure
 * proper isolation between the two payment systems.
 *
 * ⚠️ CRITICAL MIGRATION NEEDED:
 * This file uses the legacy Student model which has been removed.
 * All functions that update Student records need to be migrated to:
 * - ProgramProfile/BillingAssignment for payment method capture
 * - Subscription model for subscription management
 * - Person model for customer identification
 */

import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

import type { Prisma } from '@prisma/client'
import type Stripe from 'stripe'

import { prisma } from '@/lib/db'
import { getNewStudentStatus } from '@/lib/queries/subscriptions'
import { verifyDugsiWebhook } from '@/lib/stripe-dugsi'
import { parseDugsiReferenceId } from '@/lib/utils/dugsi-payment'
import {
  updateStudentsInTransaction,
  buildCancellationUpdateData,
} from '@/lib/utils/student-updates'
import {
  extractCustomerId,
  extractPeriodDates,
  isValidSubscriptionStatus,
} from '@/lib/utils/type-guards'

/**
 * Handle successful payment method capture (checkout.session.completed).
 * This happens when a parent completes the $1 payment to save their payment method.
 */
async function handlePaymentMethodCaptured(
  session: Stripe.Checkout.Session
): Promise<void> {
  const { client_reference_id, customer, customer_email, payment_intent } =
    session

  console.log('💳 Processing Dugsi payment method capture:', {
    referenceId: client_reference_id,
    customer,
    email: customer_email,
    paymentIntent: payment_intent,
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

  // TODO: Migrate to ProgramProfile/BillingAssignment model - Student model removed
  try {
    console.warn(
      `⚠️ Payment method capture skipped - migration needed for family ${familyId}`
    )
    // Stub: Return success but don't update database
    // In production, this should update ProgramProfile/BillingAssignment records
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

  // Validate subscription status using type guard
  if (!isValidSubscriptionStatus(subscription.status)) {
    throw new Error(`Invalid subscription status: ${subscription.status}`)
  }

  // Extract period dates
  const periodDates = extractPeriodDates(subscription)

  // TODO: Migrate to Subscription/BillingAssignment model - Student model removed
  try {
    console.warn(
      `⚠️ Subscription event skipped - migration needed for customer ${customerId}, subscription ${subscriptionId}`
    )
    // Stub: Return success but don't update database
    // In production, this should update Subscription and BillingAssignment records
  } catch (error) {
    console.error('❌ Error handling subscription event:', error)
    throw error
  }
}

/**
 * Handle invoice finalization to capture PaymentIntent IDs.
 * This is the reliable way to get PaymentIntent IDs for subscriptions.
 */
async function handleInvoiceFinalized(invoice: Stripe.Invoice): Promise<void> {
  // Cast to any for webhook context where these properties exist but aren't in the type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invoiceWithExtras = invoice as any

  // Only process first subscription invoice (not renewals)
  if (
    !invoiceWithExtras.subscription ||
    invoice.billing_reason !== 'subscription_create'
  ) {
    console.log(`⏭️ Skipping non-subscription-create invoice: ${invoice.id}`, {
      billing_reason: invoice.billing_reason,
    })
    return
  }

  // Extract PaymentIntent ID from invoice
  const paymentIntentId = invoiceWithExtras.payment_intent
    ? typeof invoiceWithExtras.payment_intent === 'string'
      ? invoiceWithExtras.payment_intent
      : invoiceWithExtras.payment_intent?.id
    : null

  // Extract customer ID
  const customerId =
    typeof invoice.customer === 'string'
      ? invoice.customer
      : invoice.customer?.id

  if (!paymentIntentId || !customerId) {
    console.warn('⚠️ Invoice missing payment_intent or customer:', invoice.id, {
      paymentIntentId,
      customerId,
    })
    return
  }

  console.log('💳 Capturing PaymentIntent from invoice:', {
    invoiceId: invoice.id,
    customerId,
    paymentIntentId,
    billing_reason: invoice.billing_reason,
  })

  // TODO: Migrate to ProgramProfile/BillingAssignment model - Student model removed
  try {
    console.warn(
      `⚠️ PaymentIntent capture skipped - migration needed for customer ${customerId}, paymentIntent ${paymentIntentId}`
    )
    // Stub: Return success but don't update database
    // In production, this should update ProgramProfile/BillingAssignment records
  } catch (error) {
    console.error('❌ Error updating PaymentIntent IDs:', error)
    throw error
  }
}

/**
 * Main webhook handler for Dugsi Stripe events.
 */
export async function POST(req: Request) {
  let eventId: string | undefined

  try {
    // Read raw body once for signature verification
    const body = await req.text()

    // Validate body is not empty
    if (!body || body.trim().length === 0) {
      console.error('❌ Empty request body')
      return NextResponse.json(
        { message: 'Request body is required' },
        { status: 400 }
      )
    }

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
    // This validates the signature against the raw body
    let event: Stripe.Event
    try {
      event = verifyDugsiWebhook(body, signature)
    } catch (verificationError) {
      // Signature verification failed - return 401
      const errorMessage =
        verificationError instanceof Error
          ? verificationError.message
          : 'Unknown verification error'
      console.error('❌ Dugsi webhook verification failed:', errorMessage)
      return NextResponse.json(
        { message: 'Invalid webhook signature' },
        { status: 401 }
      )
    }

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

    // Parse JSON payload safely after signature verification
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
        source: 'dugsi',
        payload: payload,
      },
    })

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed':
        await handlePaymentMethodCaptured(
          event.data.object as Stripe.Checkout.Session
        )
        break

      case 'invoice.finalized':
        await handleInvoiceFinalized(event.data.object as Stripe.Invoice)
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

        // TODO: Migrate to Subscription/BillingAssignment model - Student model removed
        console.warn(
          `⚠️ Subscription cancellation skipped - migration needed for customer ${canceledCustomerId}, subscription ${canceledSub.id}`
        )
        // Stub: Return success but don't update database
        // In production, this should update Subscription and BillingAssignment records
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
    // Signature and validation errors should return 400/401 (client errors)
    if (
      errorMessage.includes('Missing signature') ||
      errorMessage.includes('verification failed') ||
      errorMessage.includes('Webhook verification failed')
    ) {
      return NextResponse.json(
        { message: 'Invalid webhook signature' },
        { status: 401 }
      )
    }

    // Validation errors (malformed data, missing required fields)
    if (
      errorMessage.includes('Invalid reference ID') ||
      errorMessage.includes('Invalid JSON payload') ||
      errorMessage.includes('Request body is required')
    ) {
      return NextResponse.json({ message: errorMessage }, { status: 400 })
    }

    // Data consistency issues (missing client_reference_id, invalid customer ID, student not found, etc.)
    // These are not webhook failures - return 200 to prevent Stripe retry
    if (
      errorMessage.includes('No client_reference_id') ||
      errorMessage.includes('Invalid or missing customer ID') ||
      errorMessage.includes('No students found') ||
      errorMessage.includes('No students found for family')
    ) {
      console.warn('Data issue, returning 200 to prevent retry:', errorMessage)
      return NextResponse.json(
        { received: true, warning: errorMessage },
        { status: 200 }
      )
    }

    // For other unexpected errors, return 500 to trigger Stripe retry
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Force dynamic rendering
export const dynamic = 'force-dynamic'
