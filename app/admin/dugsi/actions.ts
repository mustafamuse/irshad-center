'use server'

import { revalidatePath } from 'next/cache'

import { GradeLevel } from '@prisma/client'

import { ActionError } from '@/lib/errors/action-error'
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
  setPrimaryPayer as setPrimaryPayerService,
  // Payment service
  verifyBankAccount,
  getPaymentStatus,
  generatePaymentLink as generatePaymentLinkService,
  // Checkout service
  createDugsiCheckoutSession,
} from '@/lib/services/dugsi'
import { validateOverrideAmount } from '@/lib/utils/dugsi-tuition'

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
    await logError(logger, error, 'Failed to validate Dugsi subscription', {
      subscriptionId,
    })
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
    await logError(logger, error, 'Failed to get delete preview', {
      studentId,
    })
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
    await logError(logger, error, 'Failed to delete family', { studentId })
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
    await logError(logger, error, 'Failed to link Dugsi subscription', {
      parentEmail: params.parentEmail,
      subscriptionId: params.subscriptionId,
    })
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
    await logError(logger, error, 'Failed to get payment status', {
      parentEmail,
    })
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
    await logError(logger, error, 'Failed to verify bank account', {
      paymentIntentId,
    })

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
    await logError(logger, error, 'Failed to update parent information', {
      studentId: params.studentId,
      parentNumber: params.parentNumber,
    })
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
    await logError(logger, error, 'Failed to add second parent', {
      studentId: params.studentId,
    })
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to add second parent',
    }
  }
}

/**
 * Set which parent is the primary payer for a family.
 */
export async function setPrimaryPayer(params: {
  studentId: string
  parentNumber: 1 | 2
}): Promise<ActionResult<{ updated: number }>> {
  try {
    const result = await setPrimaryPayerService(params)
    revalidatePath('/admin/dugsi')

    return {
      success: true,
      data: result,
      message: `Parent ${params.parentNumber} is now the primary payer`,
    }
  } catch (error) {
    await logError(logger, error, 'Failed to set primary payer', {
      studentId: params.studentId,
      parentNumber: params.parentNumber,
    })
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to set primary payer',
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
    await logError(logger, error, 'Failed to update child information', {
      studentId: params.studentId,
    })
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
    await logError(logger, error, 'Failed to add child to family', {
      existingStudentId: params.existingStudentId,
    })
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
    await logError(logger, error, 'Failed to generate payment link', {
      studentId,
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
 * SECURITY: Uses createDugsiCheckoutSession service which always
 * gets child count from database, preventing billing manipulation.
 *
 * @param input - Family ID, child count (for display only), and optional override amount (in cents)
 * @returns Payment link data with rate information
 */
export async function generateFamilyPaymentLinkAction(
  input: GenerateFamilyPaymentLinkInput
): Promise<ActionResult<FamilyPaymentLinkData>> {
  const { familyId, childCount, overrideAmount } = input

  try {
    // Validate override amount if provided (early validation before service call)
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

    // Call the checkout service (uses DB child count for security)
    const result = await createDugsiCheckoutSession({
      familyId,
      overrideAmount,
    })

    return {
      success: true,
      data: {
        paymentUrl: result.url,
        calculatedRate: result.calculatedRate,
        finalRate: result.finalRate,
        isOverride: result.isOverride,
        rateDescription: result.rateDescription,
        tierDescription: result.tierDescription,
        familyName: result.familyName,
        childCount: result.childCount,
      },
    }
  } catch (error) {
    // Handle ActionError from service
    if (error instanceof ActionError) {
      return {
        success: false,
        error: error.message,
      }
    }

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
