/**
 * Dugsi Webhook Handler
 *
 * Refactored to use base webhook handler for DRY architecture.
 * Handles Stripe webhook events from the Dugsi account.
 *
 * Responsibilities:
 * - Route webhook events to appropriate handlers (via base handler)
 * - Handle Dugsi-specific logic (guardian relationships, family linking)
 * - Delegate common operations to webhook service
 */

import * as Sentry from '@sentry/nextjs'
import type Stripe from 'stripe'

import { prisma } from '@/lib/db'
import { getBillingAccountByStripeCustomerId } from '@/lib/db/queries/billing'
import { getProgramProfilesByFamilyId } from '@/lib/db/queries/program-profile'
import { createWebhookLogger } from '@/lib/logger'
import { handleSubscriptionCancellationEnrollments } from '@/lib/services/shared/enrollment-service'
import { createWebhookHandler } from '@/lib/services/webhooks/base-webhook-handler'
import {
  handlePaymentMethodCapture,
  handleSubscriptionCreated,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted as handleSubscriptionDeletedService,
} from '@/lib/services/webhooks/webhook-service'
import { verifyDugsiWebhook } from '@/lib/stripe-dugsi'
import { parseDugsiReferenceId } from '@/lib/utils/dugsi-payment'
import { extractCustomerId } from '@/lib/utils/type-guards'

const logger = createWebhookLogger('dugsi')

/**
 * Handle successful payment method capture (checkout.session.completed).
 *
 * Dugsi-specific logic:
 * - Parse family reference ID from session
 * - Find guardian via GuardianRelationship
 * - Delegate billing account creation to service
 */
async function handlePaymentMethodCaptured(
  session: Stripe.Checkout.Session
): Promise<void> {
  const { client_reference_id, customer, customer_email } = session

  logger.info(
    {
      referenceId: client_reference_id,
      customer,
      email: customer_email,
    },
    'Processing Dugsi payment method capture'
  )

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
    const profiles = await Sentry.startSpan(
      {
        name: 'dugsi.get_family_profiles',
        op: 'db.query',
        attributes: {
          family_id: familyId,
        },
      },
      async () => await getProgramProfilesByFamilyId(familyId)
    )

    if (profiles.length === 0) {
      logger.warn(
        { familyId },
        'No profiles found for family, skipping payment method capture'
      )
      return
    }

    // Find guardian person ID
    let guardianPersonId: string | null = null

    // Try GuardianRelationship first
    const firstChildProfile = profiles[0]
    const guardianRelationship = await Sentry.startSpan(
      {
        name: 'dugsi.find_guardian_relationship',
        op: 'db.query',
        attributes: {
          dependent_id: firstChildProfile.personId,
        },
      },
      async () =>
        await prisma.guardianRelationship.findFirst({
          where: {
            dependentId: firstChildProfile.personId,
            isActive: true,
            role: 'PARENT',
          },
          orderBy: {
            createdAt: 'asc', // Use first guardian (parent 1)
          },
        })
    )

    if (guardianRelationship) {
      guardianPersonId = guardianRelationship.guardianId
    } else if (customer_email) {
      // Fallback: Try to find parent by email from checkout session
      const parentPerson = await prisma.person.findFirst({
        where: {
          contactPoints: {
            some: {
              type: 'EMAIL',
              value: customer_email.toLowerCase().trim(),
            },
          },
        },
      })

      if (parentPerson) {
        guardianPersonId = parentPerson.id
      }
    }

    if (!guardianPersonId) {
      throw new Error(
        `No guardian found for family ${familyId} - cannot create billing account`
      )
    }

    // Delegate to webhook service for payment method capture
    const result = await Sentry.startSpan(
      {
        name: 'dugsi.capture_payment_method',
        op: 'webhook.processing',
        attributes: {
          family_id: familyId,
          guardian_person_id: guardianPersonId,
          customer_id: customer,
        },
      },
      async () =>
        await handlePaymentMethodCapture(session, 'DUGSI', guardianPersonId)
    )

    logger.info(
      {
        familyId,
        billingAccountId: result.billingAccountId,
        customerId: result.customerId,
        guardianPersonId,
      },
      'Payment method captured successfully'
    )
  } catch (error) {
    logger.error({ err: error }, 'Error capturing payment method')
    throw error
  }
}

/**
 * Handle subscription creation event.
 *
 * Dugsi-specific logic:
 * - Find family profiles via GuardianRelationship
 * - Delegate subscription creation and linking to service
 */
async function handleSubscriptionCreatedEvent(
  subscription: Stripe.Subscription
): Promise<void> {
  const customerId = extractCustomerId(subscription.customer)

  if (!customerId) {
    throw new Error('Invalid or missing customer ID in subscription')
  }

  logger.info(
    {
      customerId,
      subscriptionId: subscription.id,
      status: subscription.status,
    },
    'Processing Dugsi subscription creation'
  )

  try {
    // Find billing account by Stripe customer ID
    const billingAccount = await getBillingAccountByStripeCustomerId(
      customerId,
      'DUGSI'
    )

    if (!billingAccount) {
      logger.warn(
        { customerId },
        'No billing account found for customer, subscription cannot be linked'
      )
      return
    }

    // Find family profiles via GuardianRelationship
    let profileIds: string[] = []

    if (billingAccount.personId) {
      const guardianId = billingAccount.personId // For TypeScript
      // Find all children (dependents) of this guardian
      const guardianRelationships = await Sentry.startSpan(
        {
          name: 'dugsi.find_dependents',
          op: 'db.query',
          attributes: {
            guardian_id: guardianId,
          },
        },
        async () =>
          await prisma.guardianRelationship.findMany({
            where: {
              guardianId,
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
                  },
                },
              },
            },
          })
      )

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
      if (familyId) {
        const familyProfiles = await getProgramProfilesByFamilyId(familyId)
        profileIds = familyProfiles.map((p) => p.id)
      } else {
        profileIds = profilesToLink.map((p) => p.id)
      }
    }

    // Delegate to webhook service for subscription creation
    const result = await handleSubscriptionCreated(
      subscription,
      'DUGSI',
      profileIds.length > 0 ? profileIds : undefined
    )

    logger.info(
      {
        subscriptionId: result.subscriptionId,
        profilesLinked: profileIds.length,
      },
      'Subscription created successfully'
    )
  } catch (error) {
    logger.error({ err: error }, 'Error handling subscription creation')
    throw error
  }
}

/**
 * Handle subscription update event.
 *
 * Delegates to webhook service for status update.
 */
async function handleSubscriptionUpdatedEvent(
  subscription: Stripe.Subscription
): Promise<void> {
  logger.info(
    {
      subscriptionId: subscription.id,
      status: subscription.status,
    },
    'Processing Dugsi subscription update'
  )

  try {
    // Delegate to webhook service for subscription update
    const result = await handleSubscriptionUpdated(subscription)

    logger.info(
      {
        subscriptionId: result.subscriptionId,
        status: result.status,
      },
      'Subscription updated successfully'
    )
  } catch (error) {
    logger.error({ err: error }, 'Error handling subscription update')
    throw error
  }
}

/**
 * Handle invoice finalization.
 *
 * Dugsi-specific: Captures PaymentIntent IDs for subscription_create invoices.
 * Also delegates to service for updating subscription paidUntil date.
 */
async function handleInvoiceFinalizedEvent(
  invoice: Stripe.Invoice
): Promise<void> {
  logger.info(
    {
      invoiceId: invoice.id,
      billingReason: invoice.billing_reason,
    },
    'Processing Dugsi invoice finalized'
  )

  // Extract customer ID
  const customerId =
    typeof invoice.customer === 'string'
      ? invoice.customer
      : invoice.customer?.id

  if (!customerId) {
    logger.warn({ invoiceId: invoice.id }, 'Invoice missing customer ID')
    return
  }

  try {
    // Find billing account
    const billingAccount = await getBillingAccountByStripeCustomerId(
      customerId,
      'DUGSI'
    )

    if (!billingAccount) {
      logger.warn(
        { customerId },
        'No billing account found for customer, skipping invoice'
      )
      return
    }

    // Dugsi-specific: Capture PaymentIntent ID for first subscription invoice
    if (invoice.billing_reason === 'subscription_create') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invoiceWithExtras = invoice as any
      const paymentIntentId = invoiceWithExtras.payment_intent
        ? typeof invoiceWithExtras.payment_intent === 'string'
          ? invoiceWithExtras.payment_intent
          : invoiceWithExtras.payment_intent?.id
        : null

      if (paymentIntentId && billingAccount.personId) {
        // Import upsertBillingAccount here since we need it for Dugsi-specific logic
        const { upsertBillingAccount } = await import(
          '@/lib/db/queries/billing'
        )

        await Sentry.startSpan(
          {
            name: 'dugsi.update_payment_intent',
            op: 'db.query',
            attributes: {
              customer_id: customerId,
              payment_intent_id: paymentIntentId,
            },
          },
          async () =>
            await upsertBillingAccount({
              personId: billingAccount.personId,
              accountType: 'DUGSI',
              stripeCustomerIdDugsi: customerId,
              paymentIntentIdDugsi: paymentIntentId,
            })
        )

        logger.info(
          {
            billingAccountId: billingAccount.id,
            paymentIntentId,
          },
          'PaymentIntent captured'
        )
      }
    }

    logger.info(
      {
        invoiceId: invoice.id,
        customerId,
      },
      'Invoice finalized successfully'
    )
  } catch (error) {
    logger.error({ err: error }, 'Error handling invoice finalized')
    throw error
  }
}

/**
 * Handle subscription deletion.
 *
 * Delegates to service for deactivation, then updates Dugsi-specific enrollment status.
 */
async function handleSubscriptionDeletedEvent(
  subscription: Stripe.Subscription
): Promise<void> {
  const customerId = extractCustomerId(subscription.customer)
  const subscriptionId = subscription.id

  if (!customerId) {
    throw new Error('Invalid customer ID in canceled subscription')
  }

  logger.info(
    {
      customerId,
      subscriptionId,
    },
    'Processing Dugsi subscription deletion'
  )

  try {
    // Update enrollment status to WITHDRAWN BEFORE deleting subscription
    const enrollmentResult = await handleSubscriptionCancellationEnrollments(
      subscriptionId,
      'Subscription canceled'
    )

    logger.info(
      {
        withdrawn: enrollmentResult.withdrawn,
        errors: enrollmentResult.errors.length,
      },
      'Updated enrollments to WITHDRAWN'
    )

    // Delegate to webhook service for subscription deletion
    const result = await handleSubscriptionDeletedService(subscription)

    logger.info(
      {
        subscriptionId: result.subscriptionId,
        enrollmentsWithdrawn: enrollmentResult.withdrawn,
      },
      'Subscription deleted successfully'
    )
  } catch (error) {
    logger.error({ err: error }, 'Error handling subscription deletion')
    throw error
  }
}

/**
 * Event handler wrappers that extract the correct object type from Stripe.Event
 */

async function handleCheckoutSessionCompletedEvent(event: Stripe.Event) {
  await handlePaymentMethodCaptured(
    event.data.object as Stripe.Checkout.Session
  )
}

async function handleInvoiceFinalizedEventWrapper(event: Stripe.Event) {
  await handleInvoiceFinalizedEvent(event.data.object as Stripe.Invoice)
}

async function handleSubscriptionCreatedEventWrapper(event: Stripe.Event) {
  await handleSubscriptionCreatedEvent(event.data.object as Stripe.Subscription)
}

async function handleSubscriptionUpdatedEventWrapper(event: Stripe.Event) {
  await handleSubscriptionUpdatedEvent(event.data.object as Stripe.Subscription)
}

async function handleSubscriptionDeletedEventWrapper(event: Stripe.Event) {
  await handleSubscriptionDeletedEvent(event.data.object as Stripe.Subscription)
}

/**
 * Main webhook handler for Dugsi Stripe events.
 * Created using base webhook handler factory.
 */
export const POST = createWebhookHandler({
  source: 'dugsi',
  verifyWebhook: verifyDugsiWebhook,
  eventHandlers: {
    'checkout.session.completed': handleCheckoutSessionCompletedEvent,
    'invoice.finalized': handleInvoiceFinalizedEventWrapper,
    'customer.subscription.created': handleSubscriptionCreatedEventWrapper,
    'customer.subscription.updated': handleSubscriptionUpdatedEventWrapper,
    'customer.subscription.deleted': handleSubscriptionDeletedEventWrapper,
  },
})

export const dynamic = 'force-dynamic'
