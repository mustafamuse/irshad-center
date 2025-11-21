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
import { $Enums } from '@prisma/client'

// Extract enum type for convenience
type SubscriptionStatus = $Enums.SubscriptionStatus
import type Stripe from 'stripe'

import { prisma } from '@/lib/db'
import {
  getBillingAccountByStripeCustomerId,
  upsertBillingAccount,
  createSubscription,
  createBillingAssignment,
  updateBillingAssignmentStatus,
  updateSubscriptionStatus,
  getSubscriptionByStripeId,
  getBillingAssignmentsBySubscription,
} from '@/lib/db/queries/billing'
import { updateEnrollmentStatus } from '@/lib/db/queries/enrollment'
import { getProgramProfilesByFamilyId } from '@/lib/db/queries/program-profile'
import { verifyDugsiWebhook } from '@/lib/stripe-dugsi'
import { parseDugsiReferenceId } from '@/lib/utils/dugsi-payment'
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

  try {
    // Get profiles for this family
    const profiles = await getProgramProfilesByFamilyId(familyId)

    if (profiles.length === 0) {
      console.warn(
        `⚠️ No profiles found for family ${familyId} - skipping payment method capture`
      )
      return
    }

    // Get the guardian person via GuardianRelationship
    // Use the first child's profile to find their guardian
    const firstChildProfile = profiles[0]
    const guardianRelationship = await prisma.guardianRelationship.findFirst({
      where: {
        dependentId: firstChildProfile.personId,
        isActive: true,
        role: 'PARENT',
      },
      include: {
        guardian: {
          include: {
            contactPoints: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc', // Use first guardian (parent 1)
      },
    })

    if (!guardianRelationship) {
      // Fallback: Try to find parent by email from checkout session
      if (customer_email) {
        const parentPerson = await prisma.person.findFirst({
          where: {
            contactPoints: {
              some: {
                type: 'EMAIL',
                value: customer_email.toLowerCase().trim(),
              },
            },
          },
          include: {
            contactPoints: true,
          },
        })

        if (parentPerson) {
          // Find or create billing account for this parent
          let billingAccount = await getBillingAccountByStripeCustomerId(
            customer,
            'DUGSI'
          )

          if (!billingAccount) {
            billingAccount = await upsertBillingAccount({
              personId: parentPerson.id,
              accountType: 'DUGSI',
              stripeCustomerIdDugsi: customer,
              paymentMethodCaptured: true,
              paymentMethodCapturedAt: new Date(),
            })
          } else {
            billingAccount = await upsertBillingAccount({
              personId: billingAccount.personId || parentPerson.id,
              accountType: 'DUGSI',
              stripeCustomerIdDugsi: customer,
              paymentMethodCaptured: true,
              paymentMethodCapturedAt: new Date(),
            })
          }

          console.log(
            '✅ Payment method captured successfully (via email fallback):',
            {
              familyId,
              billingAccountId: billingAccount.id,
              customerId: customer,
            }
          )
          return
        }
      }

      throw new Error(
        `No guardian found for family ${familyId} - cannot create billing account`
      )
    }

    const guardianPerson = guardianRelationship.guardian

    // Find or create billing account for this guardian
    let billingAccount = await getBillingAccountByStripeCustomerId(
      customer,
      'DUGSI'
    )

    if (!billingAccount) {
      // Create billing account if it doesn't exist
      billingAccount = await upsertBillingAccount({
        personId: guardianPerson.id,
        accountType: 'DUGSI',
        stripeCustomerIdDugsi: customer,
        paymentMethodCaptured: true,
        paymentMethodCapturedAt: new Date(),
      })
    } else {
      // Update existing billing account
      billingAccount = await upsertBillingAccount({
        personId: billingAccount.personId || guardianPerson.id,
        accountType: 'DUGSI',
        stripeCustomerIdDugsi: customer,
        paymentMethodCaptured: true,
        paymentMethodCapturedAt: new Date(),
      })
    }

    console.log('✅ Payment method captured successfully:', {
      familyId,
      billingAccountId: billingAccount.id,
      customerId: customer,
      guardianPersonId: guardianPerson.id,
    })
  } catch (error) {
    console.error('❌ Error updating billing account:', error)
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
    // Find billing account by Stripe customer ID
    let billingAccount = await getBillingAccountByStripeCustomerId(
      customerId,
      'DUGSI'
    )

    if (!billingAccount) {
      console.warn(
        `⚠️ No billing account found for customer ${customerId} - subscription cannot be linked`
      )
      return
    }

    // Check if subscription already exists
    let subscriptionRecord = await getSubscriptionByStripeId(subscriptionId)

    const subscriptionStatus = subscription.status as SubscriptionStatus

    if (!subscriptionRecord) {
      // Create new subscription
      const amount = subscription.items.data[0]?.price?.unit_amount || 0
      subscriptionRecord = await createSubscription({
        billingAccountId: billingAccount.id,
        stripeAccountType: 'DUGSI',
        stripeSubscriptionId: subscriptionId,
        stripeCustomerId: customerId,
        status: subscriptionStatus,
        amount,
        currency: subscription.currency || 'usd',
        interval:
          subscription.items.data[0]?.price?.recurring?.interval || 'month',
        currentPeriodStart: periodDates.periodStart,
        currentPeriodEnd: periodDates.periodEnd,
        paidUntil: periodDates.periodEnd,
      })

      console.log('✅ Created new subscription:', {
        subscriptionId: subscriptionRecord.id,
        stripeSubscriptionId: subscriptionId,
      })
    } else {
      // Update existing subscription
      subscriptionRecord = await updateSubscriptionStatus(
        subscriptionRecord.id,
        subscriptionStatus,
        {
          currentPeriodStart: periodDates.periodStart,
          currentPeriodEnd: periodDates.periodEnd,
          paidUntil: periodDates.periodEnd,
        }
      )

      console.log('✅ Updated subscription:', {
        subscriptionId: subscriptionRecord.id,
        stripeSubscriptionId: subscriptionId,
        status: subscriptionStatus,
      })
    }

    // Try to find profiles by billing account's person (guardian)
    if (billingAccount.personId) {
      // Find all children (dependents) of this guardian via GuardianRelationship
      const guardianRelationships = await prisma.guardianRelationship.findMany({
        where: {
          guardianId: billingAccount.personId,
          isActive: true,
          role: 'PARENT',
        },
        include: {
          dependent: {
            include: {
              programProfiles: {
                where: {
                  program: 'DUGSI_PROGRAM',
                },
                include: {
                  enrollments: {
                    where: {
                      status: { not: 'WITHDRAWN' },
                      endDate: null,
                    },
                  },
                },
              },
            },
          },
        },
      })

      // Collect all Dugsi profiles from dependents
      const profilesToLink: Array<{
        id: string
        familyReferenceId: string | null
      }> = []

      for (const rel of guardianRelationships) {
        profilesToLink.push(...rel.dependent.programProfiles)
      }

      // If profiles have a familyReferenceId, get all profiles in that family
      const familyId = profilesToLink[0]?.familyReferenceId
      const finalProfilesToLink =
        familyId && profilesToLink.length > 0
          ? await getProgramProfilesByFamilyId(familyId)
          : await prisma.programProfile.findMany({
              where: {
                id: { in: profilesToLink.map((p) => p.id) },
              },
              include: {
                enrollments: {
                  where: {
                    status: { not: 'WITHDRAWN' },
                    endDate: null,
                  },
                },
              },
            })

      if (finalProfilesToLink.length > 0) {
        // Create billing assignments for each profile
        const amount = subscription.items.data[0]?.price?.unit_amount || 0
        const amountPerProfile = Math.floor(amount / finalProfilesToLink.length)

        for (const profile of finalProfilesToLink) {
          // Check if assignment already exists
          const existingAssignments = await getBillingAssignmentsBySubscription(
            subscriptionRecord.id
          )
          const existingAssignment = existingAssignments.find(
            (a) => a.programProfileId === profile.id && a.isActive
          )

          if (!existingAssignment) {
            await createBillingAssignment({
              subscriptionId: subscriptionRecord.id,
              programProfileId: profile.id,
              amount: amountPerProfile,
              percentage:
                finalProfilesToLink.length > 1
                  ? (amountPerProfile / amount) * 100
                  : null,
            })

            console.log('✅ Created billing assignment:', {
              profileId: profile.id,
              subscriptionId: subscriptionRecord.id,
              amount: amountPerProfile,
            })
          }
        }
      }
    }
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

  try {
    // Find billing account by Stripe customer ID
    const billingAccount = await getBillingAccountByStripeCustomerId(
      customerId,
      'DUGSI'
    )

    if (!billingAccount) {
      console.warn(
        `⚠️ No billing account found for customer ${customerId} - cannot update PaymentIntent`
      )
      return
    }

    // Update billing account with PaymentIntent ID
    await upsertBillingAccount({
      personId: billingAccount.personId,
      accountType: 'DUGSI',
      stripeCustomerIdDugsi: customerId,
      paymentIntentIdDugsi: paymentIntentId,
    })

    console.log('✅ PaymentIntent captured successfully:', {
      billingAccountId: billingAccount.id,
      customerId,
      paymentIntentId,
    })
  } catch (error) {
    console.error('❌ Error updating PaymentIntent IDs:', error)
    throw error
  }
}

/**
 * Handle subscription deletion.
 * Deactivates billing assignments and updates enrollment status.
 */
async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  const customerId = extractCustomerId(subscription.customer)
  const subscriptionId = subscription.id

  if (!customerId) {
    throw new Error('Invalid customer ID in canceled subscription')
  }

  console.log('🗑️ Processing Dugsi subscription deletion:', {
    customerId,
    subscriptionId,
  })

  try {
    // Find subscription record
    const subscriptionRecord = await getSubscriptionByStripeId(subscriptionId)

    if (!subscriptionRecord) {
      console.warn(
        `⚠️ Subscription ${subscriptionId} not found in database - skipping deletion`
      )
      return
    }

    // Get all active billing assignments for this subscription
    const assignments = await getBillingAssignmentsBySubscription(
      subscriptionRecord.id
    )

    // Deactivate all billing assignments
    for (const assignment of assignments) {
      if (assignment.isActive) {
        await updateBillingAssignmentStatus(assignment.id, false, new Date())

        // Update enrollment status to WITHDRAWN
        const activeEnrollment = await prisma.enrollment.findFirst({
          where: {
            programProfileId: assignment.programProfileId,
            status: { not: 'WITHDRAWN' },
            endDate: null,
          },
        })

        if (activeEnrollment) {
          await updateEnrollmentStatus(
            activeEnrollment.id,
            'WITHDRAWN',
            'Subscription canceled',
            new Date()
          )
        }

        console.log('✅ Deactivated billing assignment:', {
          assignmentId: assignment.id,
          profileId: assignment.programProfileId,
        })
      }
    }

    // Update subscription status to canceled
    await updateSubscriptionStatus(subscriptionRecord.id, 'canceled')

    console.log('✅ Subscription deleted successfully:', {
      subscriptionId: subscriptionRecord.id,
      assignmentsDeactivated: assignments.length,
    })
  } catch (error) {
    console.error('❌ Error handling subscription deletion:', error)
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

        await handleSubscriptionDeleted(canceledSub)
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
