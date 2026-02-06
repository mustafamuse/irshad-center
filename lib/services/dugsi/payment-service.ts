/**
 * Dugsi Payment Service
 *
 * Business logic for Dugsi payment operations.
 * Handles bank verification and payment status.
 *
 * Responsibilities:
 * - Verify bank accounts via microdeposits
 * - Get payment status for families
 */

import * as Sentry from '@sentry/nextjs'

import { DUGSI_PROGRAM } from '@/lib/constants/dugsi'
import { prisma } from '@/lib/db'
import { getBillingAssignmentsByProfile } from '@/lib/db/queries/billing'
import { getProgramProfilesByFamilyId } from '@/lib/db/queries/program-profile'
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { createServiceLogger } from '@/lib/logger'
import { getDugsiStripeClient } from '@/lib/stripe-dugsi'

const logger = createServiceLogger('dugsi-payment')

/**
 * Payment status data returned by service
 */
export interface PaymentStatusData {
  familyEmail: string
  studentCount: number
  hasPaymentMethod: boolean
  hasSubscription: boolean
  stripeCustomerId: string | null
  subscriptionId: string | null
  subscriptionStatus: string | null
  paidUntil: Date | null
  currentPeriodStart: Date | null
  currentPeriodEnd: Date | null
  students: Array<{ id: string; name: string }>
  /** Family reference ID for debugging and admin operations */
  familyReferenceId: string | null
}

/**
 * Bank verification result data
 */
export interface BankVerificationData {
  paymentIntentId: string
  status: string
}

/**
 * Verify bank account using microdeposit descriptor code.
 *
 * Calls Stripe API to verify the 6-digit SM code from bank statement.
 *
 * @param paymentIntentId - Stripe payment intent ID
 * @param descriptorCode - 6-character code starting with SM
 * @returns Verification result
 * @throws Error if verification fails
 */
export async function verifyBankAccount(
  paymentIntentId: string,
  descriptorCode: string
): Promise<BankVerificationData> {
  const dugsiStripe = getDugsiStripeClient()

  logger.info(
    {
      paymentIntentId,
      descriptorCode,
    },
    'Verifying bank account'
  )

  const paymentIntent = await Sentry.startSpan(
    {
      name: 'stripe.verify_microdeposits',
      op: 'stripe.api',
      attributes: {
        payment_intent_id: paymentIntentId,
      },
    },
    async () =>
      await dugsiStripe.paymentIntents.verifyMicrodeposits(paymentIntentId, {
        descriptor_code: descriptorCode,
      })
  )

  logger.info(
    {
      paymentIntentId,
      status: paymentIntent.status,
    },
    'Bank account verified successfully'
  )

  return {
    paymentIntentId,
    status: paymentIntent.status,
  }
}

/**
 * Get payment status for a Dugsi family by parent email.
 *
 * Returns payment method status, subscription details, and family info.
 *
 * @param parentEmail - Parent's email address
 * @returns Payment status data
 * @throws Error if family not found
 */
export async function getPaymentStatus(
  parentEmail: string
): Promise<PaymentStatusData> {
  // Find person by email
  const person = await Sentry.startSpan(
    {
      name: 'dugsi.find_person_with_profiles',
      op: 'db.query',
      attributes: {
        parent_email: parentEmail,
      },
    },
    async () =>
      await prisma.person.findFirst({
        relationLoadStrategy: 'join',
        where: {
          contactPoints: {
            some: {
              type: 'EMAIL',
              value: parentEmail.toLowerCase().trim(),
            },
          },
        },
        include: {
          contactPoints: true,
          programProfiles: {
            where: {
              program: DUGSI_PROGRAM,
            },
            include: {
              enrollments: {
                where: {
                  status: { not: 'WITHDRAWN' },
                  endDate: null,
                },
              },
              assignments: {
                where: { isActive: true },
                include: {
                  subscription: {
                    include: {
                      billingAccount: true,
                    },
                  },
                },
              },
            },
          },
        },
      })
  )

  if (!person) {
    throw new ActionError(
      'Family not found',
      ERROR_CODES.FAMILY_NOT_FOUND,
      undefined,
      404
    )
  }

  const profiles = person.programProfiles || []
  if (profiles.length === 0) {
    throw new ActionError(
      'No Dugsi registrations found for this email',
      ERROR_CODES.PROFILE_NOT_FOUND,
      undefined,
      404
    )
  }

  // Get family reference ID from first profile
  const familyId = profiles[0].familyReferenceId

  // Always fetch family profiles with person relation included
  const familyProfiles = familyId
    ? await getProgramProfilesByFamilyId(familyId)
    : profiles.map((p) => ({
        ...p,
        person: person, // Use the parent person we already fetched
      }))

  // Get billing info from first profile's assignment
  const firstProfile = familyProfiles[0]
  const assignments = await getBillingAssignmentsByProfile(firstProfile.id)
  const activeAssignment = assignments.find((a) => a.isActive)
  const subscription = activeAssignment?.subscription

  // Get billing account
  const billingAccount = subscription?.billingAccount

  const students = familyProfiles.map((p) => ({
    id: p.id,
    name: 'person' in p && p.person ? p.person.name : person.name,
  }))

  return {
    familyEmail: parentEmail,
    studentCount: familyProfiles.length,
    hasPaymentMethod: billingAccount?.paymentMethodCaptured || false,
    hasSubscription: !!subscription,
    stripeCustomerId: billingAccount?.stripeCustomerIdDugsi || null,
    subscriptionId: subscription?.stripeSubscriptionId || null,
    subscriptionStatus: subscription?.status || null,
    paidUntil: subscription?.paidUntil || null,
    currentPeriodStart: subscription?.currentPeriodStart || null,
    currentPeriodEnd: subscription?.currentPeriodEnd || null,
    students,
    familyReferenceId: familyId || null,
  }
}
