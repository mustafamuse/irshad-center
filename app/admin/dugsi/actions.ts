'use server'

import { revalidatePath } from 'next/cache'

import { GradeLevel } from '@prisma/client'

import { prisma } from '@/lib/db'
import { getDugsiKeys } from '@/lib/keys/stripe'
import { createServiceLogger, logError, logWarning } from '@/lib/logger'
import {
  // Registration service
  getAllDugsiRegistrations,
  getFamilyMembers as getFamilyMembersService,
  getDeleteFamilyPreview as getDeleteFamilyPreviewService,
  deleteDugsiFamily as deleteDugsiFamilyService,
  // Subscription service
  validateDugsiSubscription as validateDugsiSubscriptionService,
  linkDugsiSubscription as linkDugsiSubscriptionService,
  // Family service
  updateParentInfo as updateParentInfoService,
  addSecondParent as addSecondParentService,
  updateChildInfo as updateChildInfoService,
  addChildToFamily as addChildToFamilyService,
  // Payment service
  verifyBankAccount,
  getPaymentStatus,
  generatePaymentLink as generatePaymentLinkService,
} from '@/lib/services/dugsi'
import { getDugsiStripeClient } from '@/lib/stripe-dugsi'
import {
  calculateDugsiRate,
  formatRate,
  formatRateDisplay,
  getStripeInterval,
  getRateTierDescription,
  validateOverrideAmount,
  MAX_EXPECTED_FAMILY_RATE,
} from '@/lib/utils/dugsi-tuition'
import { getAppUrl } from '@/lib/utils/env'

import {
  ActionResult,
  SubscriptionValidationData,
  PaymentStatusData,
  BankVerificationData,
  SubscriptionLinkData,
  DugsiRegistration,
} from './_types'

const logger = createServiceLogger('dugsi-admin-actions')

/**
 * Get all Dugsi registrations.
 */
export async function getDugsiRegistrations(): Promise<DugsiRegistration[]> {
  return await getAllDugsiRegistrations()
}

/**
 * Validate a Stripe subscription ID without linking it.
 */
export async function validateDugsiSubscription(
  subscriptionId: string
): Promise<ActionResult<SubscriptionValidationData>> {
  try {
    const result = await validateDugsiSubscriptionService(subscriptionId)
    return {
      success: true,
      data: result,
    }
  } catch (error) {
    console.error('Error validating Dugsi subscription:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to validate subscription',
    }
  }
}

/**
 * Get family members for a student.
 */
export async function getFamilyMembers(
  studentId: string
): Promise<DugsiRegistration[]> {
  return await getFamilyMembersService(studentId)
}

/**
 * Get preview of students that will be deleted.
 */
export async function getDeleteFamilyPreview(studentId: string): Promise<
  ActionResult<{
    count: number
    students: Array<{ id: string; name: string; parentEmail: string | null }>
  }>
> {
  try {
    const result = await getDeleteFamilyPreviewService(studentId)
    return {
      success: true,
      data: result,
    }
  } catch (error) {
    console.error('Error getting delete preview:', error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to get delete preview',
    }
  }
}

/**
 * Delete a Dugsi family.
 */
export async function deleteDugsiFamily(
  studentId: string
): Promise<ActionResult> {
  try {
    const count = await deleteDugsiFamilyService(studentId)
    revalidatePath('/admin/dugsi')
    return {
      success: true,
      message: `Successfully deleted ${count} ${count === 1 ? 'student' : 'students'}`,
    }
  } catch (error) {
    console.error('Error deleting family:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete family',
    }
  }
}

/**
 * Link a Stripe subscription to a Dugsi family.
 */
export async function linkDugsiSubscription(params: {
  parentEmail: string
  subscriptionId: string
}): Promise<ActionResult<SubscriptionLinkData>> {
  try {
    const { parentEmail, subscriptionId } = params

    if (!parentEmail || parentEmail.trim() === '') {
      return {
        success: false,
        error: 'Parent email is required to link subscription.',
      }
    }

    const result = await linkDugsiSubscriptionService(
      parentEmail,
      subscriptionId
    )
    revalidatePath('/admin/dugsi')

    return {
      success: true,
      data: result,
      message: `Successfully linked subscription to ${result.updated} students`,
    }
  } catch (error) {
    console.error('Error linking Dugsi subscription:', error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to link subscription',
    }
  }
}

/**
 * Get payment status for a Dugsi family.
 */
export async function getDugsiPaymentStatus(
  parentEmail: string
): Promise<ActionResult<PaymentStatusData>> {
  try {
    const result = await getPaymentStatus(parentEmail)
    return {
      success: true,
      data: result,
    }
  } catch (error) {
    console.error('Error getting payment status:', error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to get payment status',
    }
  }
}

/**
 * Verify bank account using microdeposit descriptor code.
 */
export async function verifyDugsiBankAccount(
  paymentIntentId: string,
  descriptorCode: string
): Promise<ActionResult<BankVerificationData>> {
  try {
    // Validate inputs
    if (!paymentIntentId || !paymentIntentId.startsWith('pi_')) {
      return {
        success: false,
        error: 'Invalid payment intent ID format. Must start with "pi_"',
      }
    }

    // Validate descriptor code format (6 characters, starts with SM)
    const cleanCode = descriptorCode.trim().toUpperCase()
    if (!/^SM[A-Z0-9]{4}$/.test(cleanCode)) {
      return {
        success: false,
        error:
          'Invalid descriptor code format. Must be 6 characters starting with SM (e.g., SMT86W)',
      }
    }

    const result = await verifyBankAccount(paymentIntentId, cleanCode)
    revalidatePath('/admin/dugsi')

    return {
      success: true,
      data: result,
    }
  } catch (error: unknown) {
    console.error('Error verifying bank account:', error)

    // Handle specific Stripe errors
    if (
      error &&
      typeof error === 'object' &&
      'type' in error &&
      error.type === 'StripeInvalidRequestError' &&
      'code' in error
    ) {
      if (error.code === 'payment_intent_unexpected_state') {
        return {
          success: false,
          error: 'This bank account has already been verified',
        }
      }
      if (error.code === 'incorrect_code') {
        return {
          success: false,
          error:
            'Incorrect verification code. Please check the code in the bank statement and try again',
        }
      }
      if (error.code === 'resource_missing') {
        return {
          success: false,
          error: 'Payment intent not found. The verification may have expired',
        }
      }
    }

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to verify bank account',
    }
  }
}

/**
 * Update parent information for entire family.
 */
export async function updateParentInfo(params: {
  studentId: string
  parentNumber: 1 | 2
  firstName: string
  lastName: string
  phone: string
}): Promise<ActionResult<{ updated: number }>> {
  try {
    const result = await updateParentInfoService(params)
    revalidatePath('/admin/dugsi')

    return {
      success: true,
      data: result,
      message: `Successfully updated parent information for ${result.updated} ${result.updated === 1 ? 'student' : 'students'}`,
    }
  } catch (error) {
    console.error('Error updating parent information:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to update parent information',
    }
  }
}

/**
 * Add a second parent to a family.
 */
export async function addSecondParent(params: {
  studentId: string
  firstName: string
  lastName: string
  email: string
  phone: string
}): Promise<ActionResult<{ updated: number }>> {
  try {
    const result = await addSecondParentService(params)
    revalidatePath('/admin/dugsi')

    return {
      success: true,
      data: result,
      message: `Successfully added second parent to ${result.updated} ${result.updated === 1 ? 'student' : 'students'}`,
    }
  } catch (error) {
    console.error('Error adding second parent:', error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to add second parent',
    }
  }
}

/**
 * Update child information for a specific student.
 */
export async function updateChildInfo(params: {
  studentId: string
  firstName?: string
  lastName?: string
  gender?: 'MALE' | 'FEMALE'
  dateOfBirth?: Date
  gradeLevel?: GradeLevel
  schoolName?: string
  healthInfo?: string | null
}): Promise<ActionResult> {
  try {
    await updateChildInfoService(params)
    revalidatePath('/admin/dugsi')

    return {
      success: true,
      message: 'Successfully updated child information',
    }
  } catch (error) {
    console.error('Error updating child information:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to update child information',
    }
  }
}

/**
 * Add a new child to an existing family.
 */
export async function addChildToFamily(params: {
  existingStudentId: string
  firstName: string
  lastName: string
  gender: 'MALE' | 'FEMALE'
  dateOfBirth?: Date
  gradeLevel: GradeLevel
  schoolName?: string
  healthInfo?: string | null
}): Promise<ActionResult<{ childId: string }>> {
  try {
    const result = await addChildToFamilyService(params)
    revalidatePath('/admin/dugsi')

    return {
      success: true,
      data: result,
      message: 'Successfully added child to family',
    }
  } catch (error) {
    console.error('Error adding child to family:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to add child to family',
    }
  }
}

/**
 * Generate a payment link for a Dugsi family.
 */
export async function generatePaymentLink(
  studentId: string,
  familyMembers?: DugsiRegistration[]
): Promise<
  ActionResult<{
    paymentUrl: string
    parentEmail: string
    parentPhone: string | null
    childCount: number
    familyReferenceId: string
  }>
> {
  try {
    const result = await generatePaymentLinkService(studentId, familyMembers)
    return {
      success: true,
      data: result,
    }
  } catch (error) {
    console.error('Error generating payment link:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to generate payment link',
    }
  }
}

/**
 * Input for generating family payment link with calculated/override rate
 */
export interface GenerateFamilyPaymentLinkInput {
  familyId: string
  childCount: number
  overrideAmount?: number
}

/**
 * Output from generating family payment link
 */
export interface FamilyPaymentLinkData {
  paymentUrl: string
  calculatedRate: number
  finalRate: number
  isOverride: boolean
  rateDescription: string
  tierDescription: string
  familyName: string
  childCount: number
}

/**
 * Generate a payment link for a Dugsi family with dynamic pricing.
 *
 * This creates a Stripe Checkout Session with:
 * - Calculated rate based on child count (tiered pricing)
 * - Optional admin override amount
 * - ACH-only payment method
 *
 * @param input - Family ID, child count, and optional override amount (in cents)
 * @returns Payment link data with rate information
 */
export async function generateFamilyPaymentLinkAction(
  input: GenerateFamilyPaymentLinkInput
): Promise<ActionResult<FamilyPaymentLinkData>> {
  const { familyId, childCount, overrideAmount } = input

  try {
    // Validate child count
    if (childCount < 1 || childCount > 15) {
      return {
        success: false,
        error: 'Child count must be between 1 and 15',
      }
    }

    // Validate override amount if provided
    if (overrideAmount !== undefined) {
      const validation = validateOverrideAmount(overrideAmount, childCount)
      if (!validation.valid) {
        return {
          success: false,
          error: validation.reason || 'Invalid override amount',
        }
      }
      if (validation.reason) {
        await logWarning(logger, validation.reason, {
          familyId,
          childCount,
          overrideAmount,
        })
      }
    }

    // Get family profiles with guardian information
    const familyProfiles = await prisma.programProfile.findMany({
      where: {
        familyReferenceId: familyId,
        program: 'DUGSI_PROGRAM',
        status: { in: ['REGISTERED', 'ENROLLED'] },
      },
      include: {
        person: {
          include: {
            guardianRelationships: {
              include: {
                guardian: {
                  include: {
                    contactPoints: {
                      where: { type: 'EMAIL', isActive: true },
                      orderBy: { isPrimary: 'desc' },
                      take: 1,
                    },
                    billingAccounts: {
                      select: { stripeCustomerIdDugsi: true },
                      take: 1,
                    },
                  },
                },
              },
            },
          },
        },
      },
    })

    if (familyProfiles.length === 0) {
      return {
        success: false,
        error: 'Family not found or no active students',
      }
    }

    // Get primary guardian
    const firstChild = familyProfiles[0]
    const guardianRelationships = firstChild.person.guardianRelationships || []
    const primaryGuardian = guardianRelationships[0]?.guardian

    if (!primaryGuardian) {
      return {
        success: false,
        error: 'No guardian found for this family',
      }
    }

    const guardianEmail = primaryGuardian.contactPoints[0]?.value
    if (!guardianEmail) {
      return {
        success: false,
        error: 'Guardian email address is required for payment setup',
      }
    }

    // Calculate rate
    const calculatedRate = calculateDugsiRate(childCount)
    const rateInCents = overrideAmount ?? calculatedRate
    const isOverride = overrideAmount !== undefined

    // Rate bounds validation
    if (rateInCents > MAX_EXPECTED_FAMILY_RATE) {
      await logWarning(logger, 'Unusually high rate for payment link', {
        rateInCents,
        maxExpected: MAX_EXPECTED_FAMILY_RATE,
        familyId,
        childCount,
        isOverride,
      })
    }

    // Get Stripe interval and product ID
    const intervalConfig = getStripeInterval()
    const { productId } = getDugsiKeys()

    if (!productId) {
      await logError(
        logger,
        new Error('STRIPE_DUGSI_PRODUCT_ID not configured'),
        'Stripe product not configured for Dugsi',
        { familyId }
      )
      return {
        success: false,
        error: 'Payment system not properly configured',
      }
    }

    const stripe = getDugsiStripeClient()
    const customerId =
      primaryGuardian.billingAccounts[0]?.stripeCustomerIdDugsi ?? undefined
    const childNames = familyProfiles.map((p) => p.person.name).join(', ')

    let appUrl: string
    try {
      appUrl = getAppUrl()
    } catch {
      return {
        success: false,
        error: 'App URL not configured',
      }
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['us_bank_account'],
      customer: customerId,
      customer_email: customerId ? undefined : guardianEmail,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product: productId,
            unit_amount: rateInCents,
            recurring: intervalConfig,
          },
          quantity: 1,
        },
      ],
      subscription_data: {
        metadata: {
          Family: primaryGuardian.name,
          Children: childNames,
          Rate: formatRateDisplay(rateInCents),
          Tier: getRateTierDescription(childCount),
          Source: 'Dugsi Admin Payment Link',
          familyId,
          guardianPersonId: primaryGuardian.id,
          childCount: childCount.toString(),
          profileIds: familyProfiles.map((p) => p.id).join(','),
          calculatedRate: calculatedRate.toString(),
          overrideUsed: isOverride ? 'true' : 'false',
          source: 'dugsi-admin-payment-link',
        },
      },
      metadata: {
        Family: primaryGuardian.name,
        Source: 'Dugsi Admin Payment Link',
        familyId,
        guardianPersonId: primaryGuardian.id,
        childCount: childCount.toString(),
        source: 'dugsi-admin-payment-link',
      },
      success_url: `${appUrl}/dugsi?payment=success`,
      cancel_url: `${appUrl}/dugsi?payment=canceled`,
      allow_promotion_codes: true,
    })

    if (!session.url) {
      await logError(
        logger,
        new Error('Stripe returned session without URL'),
        'Checkout session created without URL',
        { familyId, sessionId: session.id }
      )
      return {
        success: false,
        error: 'Failed to create payment link',
      }
    }

    logger.info(
      {
        familyId,
        guardianName: primaryGuardian.name,
        childCount,
        calculatedRate,
        finalRate: rateInCents,
        isOverride,
        sessionId: session.id,
      },
      'Family payment link generated'
    )

    return {
      success: true,
      data: {
        paymentUrl: session.url,
        calculatedRate,
        finalRate: rateInCents,
        isOverride,
        rateDescription: formatRate(rateInCents),
        tierDescription: getRateTierDescription(childCount),
        familyName: primaryGuardian.name,
        childCount,
      },
    }
  } catch (error) {
    await logError(logger, error, 'Failed to generate family payment link', {
      familyId,
      childCount,
      overrideAmount,
    })
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to generate payment link',
    }
  }
}
