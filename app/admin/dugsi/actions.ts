'use server'

import { revalidatePath } from 'next/cache'

import { DUGSI_PROGRAM } from '@/lib/constants/dugsi'
import { prisma } from '@/lib/db'
import { getNewStudentStatus } from '@/lib/queries/subscriptions'
import { getDugsiStripeClient } from '@/lib/stripe-dugsi'
import { updateStudentsInTransaction } from '@/lib/utils/student-updates'
import { extractPeriodDates } from '@/lib/utils/type-guards'

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
import { getFamilyPhoneNumbers } from './_utils/family'

export async function getDugsiRegistrations(): Promise<DugsiRegistration[]> {
  const students = await prisma.student.findMany({
    where: { program: DUGSI_PROGRAM },
    orderBy: { createdAt: 'desc' },
    select: DUGSI_REGISTRATION_SELECT,
  })

  return students
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
  // Get the selected student
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: DUGSI_FAMILY_SELECT,
  })

  if (!student) return []

  // Find all siblings (students with the same parent phone number)
  // Use utility function for consistent family identification
  const phoneNumbers = getFamilyPhoneNumbers(student)

  if (phoneNumbers.length === 0) return []

  const siblings = await prisma.student.findMany({
    where: {
      program: DUGSI_PROGRAM,
      OR: phoneNumbers.map((phone) => ({
        OR: [{ parentPhone: phone }, { parent2Phone: phone }],
      })),
    },
    orderBy: { createdAt: 'asc' },
    select: DUGSI_REGISTRATION_SELECT,
  })

  return siblings
}

export async function deleteDugsiFamily(
  studentId: string
): Promise<ActionResult> {
  try {
    // Get the student to find family members
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: DUGSI_FAMILY_SELECT,
    })

    if (!student) {
      return { success: false, error: 'Student not found' }
    }

    // Find all phone numbers to identify the family
    // Use utility function for consistent family identification
    const phoneNumbers = getFamilyPhoneNumbers(student)

    if (phoneNumbers.length === 0) {
      // If no phone numbers, just delete the single student
      await prisma.student.delete({
        where: { id: studentId },
      })
    } else {
      // Delete all family members (students with matching phone numbers)
      await prisma.student.deleteMany({
        where: {
          program: DUGSI_PROGRAM,
          OR: phoneNumbers.map((phone) => ({
            OR: [{ parentPhone: phone }, { parent2Phone: phone }],
          })),
        },
      })
    }

    // Revalidate the page to show updated data
    revalidatePath('/admin/dugsi')

    return { success: true }
  } catch (error) {
    console.error('Error deleting family:', error)
    return { success: false, error: 'Failed to delete family' }
  }
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
  try {
    const { parentEmail, subscriptionId } = params

    // Validate parentEmail is not null/empty to prevent matching all null emails
    if (!parentEmail || parentEmail.trim() === '') {
      return {
        success: false,
        error:
          'Parent email is required to link subscription. Please update the student record with a parent email first.',
      }
    }

    // Validate the subscription exists in Stripe
    const dugsiStripe = getDugsiStripeClient()
    const subscription =
      await dugsiStripe.subscriptions.retrieve(subscriptionId)

    if (!subscription) {
      return { success: false, error: 'Subscription not found in Stripe' }
    }

    // Extract customer ID (type guard ensures it's a string)
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer?.id

    if (!customerId) {
      return { success: false, error: 'Invalid customer ID in subscription' }
    }

    // Derive student status from subscription status
    const newStudentStatus = getNewStudentStatus(subscription.status)

    // Extract period dates
    const periodDates = extractPeriodDates(subscription)

    // Use transaction to atomically update all students in the family
    const studentsToUpdate = await prisma.$transaction(async (tx) => {
      // Find all students to update and track history
      const students = await tx.student.findMany({
        where: {
          parentEmail,
          program: DUGSI_PROGRAM,
        },
        select: DUGSI_SUBSCRIPTION_LINK_SELECT,
      })

      if (students.length === 0) {
        return []
      }

      // Update each student using centralized utility
      const updatePromises = updateStudentsInTransaction(
        students,
        {
          subscriptionId,
          customerId,
          subscriptionStatus: subscription.status,
          newStudentStatus,
          periodStart: periodDates.periodStart,
          periodEnd: periodDates.periodEnd,
          program: 'DUGSI',
        },
        tx
      )

      await Promise.all(updatePromises)

      return students
    })

    if (studentsToUpdate.length === 0) {
      return {
        success: false,
        error: 'No students found with this parent email',
      }
    }

    // Revalidate the admin page
    revalidatePath('/admin/dugsi')

    return {
      success: true,
      data: {
        updated: studentsToUpdate.length,
      },
      message: `Successfully linked subscription to ${studentsToUpdate.length} students`,
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
 * Useful for admins to see if payment method has been captured.
 */
export async function getDugsiPaymentStatus(
  parentEmail: string
): Promise<ActionResult<PaymentStatusData>> {
  try {
    const students = await prisma.student.findMany({
      where: {
        parentEmail,
        program: DUGSI_PROGRAM,
      },
      select: DUGSI_PAYMENT_STATUS_SELECT,
    })

    if (students.length === 0) {
      return { success: false, error: 'No students found for this email' }
    }

    // Check if any student has payment method captured
    const hasPaymentMethod = students.some((s) => s.paymentMethodCaptured)
    const hasSubscription = students.some((s) => s.stripeSubscriptionIdDugsi)

    return {
      success: true,
      data: {
        familyEmail: parentEmail,
        studentCount: students.length,
        hasPaymentMethod,
        hasSubscription,
        stripeCustomerId: students[0]?.stripeCustomerIdDugsi,
        subscriptionId: students[0]?.stripeSubscriptionIdDugsi,
        subscriptionStatus: students[0]?.subscriptionStatus,
        paidUntil: students[0]?.paidUntil,
        currentPeriodStart: students[0]?.currentPeriodStart,
        currentPeriodEnd: students[0]?.currentPeriodEnd,
        students: students.map((s) => ({
          id: s.id,
          name: s.name,
        })),
      },
    }
  } catch (error) {
    console.error('Error getting payment status:', error)
    return {
      success: false,
      error: 'Failed to get payment status',
    }
  }
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
