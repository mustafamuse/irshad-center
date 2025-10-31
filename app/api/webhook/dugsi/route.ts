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

  // Validate subscription status using type guard
  if (!isValidSubscriptionStatus(subscription.status)) {
    throw new Error(`Invalid subscription status: ${subscription.status}`)
  }

  // Extract period dates
  const periodDates = extractPeriodDates(subscription)

  try {
    await prisma.$transaction(async (tx) => {
      // Find all students with this Stripe customer ID
      const students = await tx.student.findMany({
        where: {
          stripeCustomerIdDugsi: customerId,
          program: 'DUGSI_PROGRAM',
        },
        select: {
          id: true,
          subscriptionStatus: true,
          stripeSubscriptionIdDugsi: true,
        },
      })

      if (students.length === 0) {
        throw new Error(`No students found for customer: ${customerId}`)
      }

      // Update each student using centralized utility
      const updatePromises = updateStudentsInTransaction(
        students,
        {
          subscriptionId,
          customerId,
          subscriptionStatus: subscription.status,
          newStudentStatus: getNewStudentStatus(subscription.status),
          periodStart: periodDates.periodStart,
          periodEnd: periodDates.periodEnd,
          program: 'DUGSI',
        },
        tx
      )

      const updateResults = await Promise.all(updatePromises)

      if (updateResults.length === 0) {
        throw new Error('Failed to update students with subscription')
      }

      console.log(
        `✅ Updated ${updateResults.length} students with subscription ${subscriptionId}`
      )

      // Log if any subscription IDs were added to history
      const studentsWithHistory = students.filter(
        (s) =>
          s.stripeSubscriptionIdDugsi &&
          s.stripeSubscriptionIdDugsi !== subscriptionId
      )
      if (studentsWithHistory.length > 0) {
        console.log(
          `📝 Added previous subscription IDs to history for ${studentsWithHistory.length} students`
        )
      }
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

        // Use transaction to atomically update all students
        await prisma.$transaction(async (tx) => {
          // Find students first to track history before updating
          const studentsToCancel = await tx.student.findMany({
            where: {
              stripeCustomerIdDugsi: canceledCustomerId,
              program: 'DUGSI_PROGRAM',
            },
          })

          if (studentsToCancel.length === 0) {
            console.warn(
              `⚠️ No students found to cancel for customer: ${canceledCustomerId}`
            )
          } else {
            // Build cancellation data using centralized utility
            const cancellationData = buildCancellationUpdateData(
              canceledSub.id,
              'DUGSI'
            )

            // Update each student with cancellation data
            await Promise.all(
              studentsToCancel.map((student) =>
                tx.student.update({
                  where: { id: student.id },
                  data: cancellationData,
                })
              )
            )
            console.log(
              `✅ Added subscription ${canceledSub.id} to history and canceled ${studentsToCancel.length} students`
            )
          }
        })
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
