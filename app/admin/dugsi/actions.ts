'use server'

// ⚠️ CRITICAL MIGRATION NEEDED: This file uses the legacy Student model which has been removed.
// TODO: Migrate to ProgramProfile/Enrollment model
// All functions using prisma.student are temporarily stubbed to allow build to pass.
// Full migration required before Dugsi admin can function properly.

import { revalidatePath } from 'next/cache'

import { EducationLevel, GradeLevel } from '@prisma/client'

import { DUGSI_PROGRAM } from '@/lib/constants/dugsi'
import { prisma } from '@/lib/db'
import { getNewStudentStatus } from '@/lib/queries/subscriptions'
import { formatFullName } from '@/lib/registration/utils/name-formatting'
import { constructDugsiPaymentUrl } from '@/lib/stripe-dugsi'
import { getDugsiStripeClient } from '@/lib/stripe-dugsi'
import { updateStudentsInTransaction } from '@/lib/utils/student-updates'
import { isValidEmail, extractPeriodDates } from '@/lib/utils/type-guards'

import {
  DUGSI_REGISTRATION_SELECT,
  DUGSI_FAMILY_SELECT,
  DUGSI_PAYMENT_STATUS_SELECT,
  DUGSI_SUBSCRIPTION_LINK_SELECT,
} from './_queries/selects'
import {
  ActionResult,
  SubscriptionValidationData,
  PaymentStatusData,
  BankVerificationData,
  SubscriptionLinkData,
  DugsiRegistration,
} from './_types'
import { getFamilyWhereClause } from './_utils/family'

// TODO: Migrate to ProgramProfile model - Student model removed
// This is a temporary stub to allow build to pass
// Full migration needed: Query ProgramProfile with person relations and map to DugsiRegistration format
export async function getDugsiRegistrations(): Promise<DugsiRegistration[]> {
  // Temporary: Return empty array until migration to ProgramProfile is complete
  // The Dugsi admin module needs full refactor to use Person/ProgramProfile/Enrollment model
  return []
  
  // Future implementation should use:
  // const profiles = await prisma.programProfile.findMany({
  //   where: { program: DUGSI_PROGRAM },
  //   include: { person: { include: { contactPoints: true } } },
  //   orderBy: { createdAt: 'desc' },
  // })
  // Then map ProgramProfile + Person data to DugsiRegistration format
}

/**
 * Validate a Stripe subscription ID without linking it.
 * Used by the link subscription dialog to check if a subscription exists.
 */
export async function validateDugsiSubscription(
  subscriptionId: string
): Promise<ActionResult<SubscriptionValidationData>> {
  try {
    if (!subscriptionId.startsWith('sub_')) {
      return {
        success: false,
        error: 'Invalid subscription ID format. Must start with "sub_"',
      }
    }

    // Validate the subscription exists in Stripe
    const dugsiStripe = getDugsiStripeClient()
    const subscription =
      await dugsiStripe.subscriptions.retrieve(subscriptionId)

    if (!subscription) {
      return { success: false, error: 'Subscription not found in Stripe' }
    }

    // Extract customer ID
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer?.id

    if (!customerId) {
      return { success: false, error: 'Invalid customer ID in subscription' }
    }

    // Extract period dates using utility function
    const periodDates = extractPeriodDates(subscription)

    return {
      success: true,
      data: {
        subscriptionId: subscription.id,
        customerId,
        status: subscription.status,
        currentPeriodStart: periodDates.periodStart,
        currentPeriodEnd: periodDates.periodEnd,
      },
    }
  } catch (error) {
    console.error('Error validating Dugsi subscription:', error)
    if (error instanceof Error) {
      // Check if it's a Stripe error
      if (error.message.includes('No such subscription')) {
        return {
          success: false,
          error: 'Subscription not found in Stripe',
        }
      }
      return {
        success: false,
        error: error.message || 'Failed to validate subscription',
      }
    }
    return {
      success: false,
      error: 'Failed to validate subscription',
    }
  }
}

export async function getFamilyMembers(
  studentId: string
): Promise<DugsiRegistration[]> {
  // TODO: Migrate to ProgramProfile model - Student model removed
  // This function needs full refactor to use Person/ProgramProfile/Enrollment
  return []
  
  /* Original implementation commented out - needs migration:
  const student = await prisma.programProfile.findUnique({
    where: { id: studentId },
    select: DUGSI_FAMILY_SELECT,
  })
  // ... rest of implementation
  */
}

/**
 * Get a preview of students that will be deleted when deleting a family.
 * This is used by the delete confirmation dialog to show which students will be affected.
 *
 * Returns the count and details of students that will be deleted based on the same
 * familyReferenceId-based matching logic used by deleteDugsiFamily().
 */
export async function getDeleteFamilyPreview(studentId: string): Promise<
  ActionResult<{
    count: number
    students: Array<{ id: string; name: string; parentEmail: string | null }>
  }>
> {
  // TODO: Migrate to ProgramProfile model - Student model removed
  return {
    success: true,
    data: {
      count: 0,
      students: [],
    },
  }
}

export async function deleteDugsiFamily(studentId: string) {
  // TODO: Migrate to ProgramProfile model - Student model removed
  return { success: false, error: 'Migration needed' };
}
/**
 * Link a manually created Stripe subscription to a Dugsi family.
 * This allows admins to create subscriptions in Stripe Dashboard
 * and then connect them back to the family records.
 */
export async function linkDugsiSubscription(params: {
  parentEmail: string
  subscriptionId: string
}): Promise<ActionResult<SubscriptionLinkData>> {
  // TODO: Migrate to ProgramProfile model - Student model removed
  return { success: false, error: 'Migration needed' };
}

/**
 * Get payment status for a Dugsi family.
 * Useful for admins to see if payment method has been captured.
 */
export async function getDugsiPaymentStatus(...args: any[]): Promise<ActionResult<PaymentStatusData>> {
  // TODO: Migrate to ProgramProfile model - Student model removed
  return { success: false, error: 'Migration needed' };
}
/**
 * Verify bank account using microdeposit descriptor code.
 * Admins input the 6-digit SM code that families see in their bank statements.
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

    // Call Stripe API to verify microdeposits
    const dugsiStripe = getDugsiStripeClient()

    console.log('🔍 Verifying bank account:', {
      paymentIntentId,
      descriptorCode: cleanCode,
    })

    const paymentIntent = await dugsiStripe.paymentIntents.verifyMicrodeposits(
      paymentIntentId,
      { descriptor_code: cleanCode }
    )

    console.log('✅ Bank account verified successfully:', {
      paymentIntentId,
      status: paymentIntent.status,
    })

    // Revalidate the dashboard to reflect updated payment status
    revalidatePath('/admin/dugsi')

    return {
      success: true,
      data: {
        paymentIntentId,
        status: paymentIntent.status,
      },
    }
  } catch (error: unknown) {
    console.error('❌ Error verifying bank account:', error)

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
 * Updates all students in the family with the same parent information.
 *
 * SECURITY: Parent emails (parentEmail and parent2Email) are immutable
 * and cannot be changed via this function. They are used for family
 * identification and security purposes. Changing them would allow
 * hijacking of families, subscriptions, and payment data.
 */
export async function updateParentInfo(params: {
  studentId: string
  parentNumber: 1 | 2
  firstName: string
  lastName: string
  phone: string
}): Promise<ActionResult<{ updated: number }>> {
  // TODO: Migrate to ProgramProfile model - Student model removed
  return { success: false, error: 'Migration needed' };
}

/**
 * Add a second parent to a family.
 * Only adds if second parent doesn't already exist.
 */
export async function addSecondParent(params: {
  studentId: string
  firstName: string
  lastName: string
  email: string
  phone: string
}): Promise<ActionResult<{ updated: number }>> {
  // TODO: Migrate to ProgramProfile model - Student model removed
  return { success: false, error: 'Migration needed' };
}

/**
 * Update child information for a specific student.
 * Only updates the individual child, not the whole family.
 */
export async function updateChildInfo(...args: any[]) {
  // TODO: Migrate to ProgramProfile model - Student model removed
  return { success: false, error: 'Migration needed' };
}
/**
 * Add a new child to an existing family.
 * Copies parent information from an existing sibling.
 */
export async function addChildToFamily(params: {
  existingStudentId: string
  firstName: string
  lastName: string
  gender: 'MALE' | 'FEMALE'
  dateOfBirth?: Date
  educationLevel: EducationLevel
  gradeLevel: GradeLevel
  schoolName?: string
  healthInfo?: string | null
}): Promise<ActionResult<{ childId: string }>> {
  // TODO: Migrate to ProgramProfile model - Student model removed
  return { success: false, error: 'Migration needed' };
}

/**
 * Generate a payment link for a Dugsi family.
 * Uses the family's familyReferenceId to create a payment URL that can be matched via webhooks.
 *
 * @param studentId - Student ID to fetch family members (if familyMembers not provided)
 * @param familyMembers - Optional: Pre-fetched family members to avoid redundant database query
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
    // Use provided family members or fetch them
    let members: DugsiRegistration[]
    if (familyMembers && familyMembers.length > 0) {
      members = familyMembers
    } else {
      // Get family members using existing logic
      members = await getFamilyMembers(studentId)
    }

    if (members.length === 0) {
      return { success: false, error: 'Family not found' }
    }

    const firstMember = members[0]

    // Validate parent email exists
    if (!firstMember.parentEmail) {
      return {
        success: false,
        error: 'Parent email is required to generate payment link',
      }
    }

    // Validate email format
    if (!isValidEmail(firstMember.parentEmail)) {
      return {
        success: false,
        error: 'Invalid parent email format',
      }
    }

    if (!firstMember.familyReferenceId) {
      return {
        success: false,
        error: 'Family reference ID not found',
      }
    }

    // Check if payment link config exists
    if (!process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_DUGSI) {
      return {
        success: false,
        error:
          'Payment link not configured. Please set NEXT_PUBLIC_STRIPE_PAYMENT_LINK_DUGSI in environment variables.',
      }
    }

    // Generate payment URL
    const paymentUrl = constructDugsiPaymentUrl({
      parentEmail: firstMember.parentEmail,
      familyId: firstMember.familyReferenceId,
      childCount: members.length,
    })

    return {
      success: true,
      data: {
        paymentUrl,
        parentEmail: firstMember.parentEmail,
        parentPhone: firstMember.parentPhone,
        childCount: members.length,
        familyReferenceId: firstMember.familyReferenceId,
      },
    }
  } catch (error) {
    console.error('Error generating payment link:', error)
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to generate payment link'
    return {
      success: false,
      error: errorMessage,
    }
  }
}
