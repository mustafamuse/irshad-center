'use server'

import { revalidatePath } from 'next/cache'

import { EducationLevel, GradeLevel } from '@prisma/client'

import { DUGSI_PROGRAM } from '@/lib/constants/dugsi'
import { prisma } from '@/lib/db'
import { getNewStudentStatus } from '@/lib/queries/subscriptions'
import { formatFullName } from '@/lib/registration/utils/name-formatting'
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

  // Find all siblings using familyReferenceId-based matching (same as getFamilyKey)
  // Priority: familyReferenceId > parentEmail > id
  let siblings: DugsiRegistration[]

  if (student.familyReferenceId) {
    // Find all students with the same familyReferenceId
    siblings = await prisma.student.findMany({
      where: {
        program: DUGSI_PROGRAM,
        familyReferenceId: student.familyReferenceId,
      },
      orderBy: { createdAt: 'asc' },
      select: DUGSI_REGISTRATION_SELECT,
    })
  } else if (student.parentEmail) {
    // Find all students with the same parentEmail (fallback)
    siblings = await prisma.student.findMany({
      where: {
        program: DUGSI_PROGRAM,
        parentEmail: student.parentEmail,
        familyReferenceId: null, // Only match students without familyReferenceId
      },
      orderBy: { createdAt: 'asc' },
      select: DUGSI_REGISTRATION_SELECT,
    })
  } else {
    // No family grouping - return just this student
    siblings = [student as DugsiRegistration]
  }

  return siblings
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
  try {
    // Get the student to find family members
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        familyReferenceId: true,
        parentEmail: true,
      },
    })

    if (!student) {
      return { success: false, error: 'Student not found' }
    }

    // Find all students that will be deleted using the same logic as deleteDugsiFamily
    let studentsToDelete

    if (student.familyReferenceId) {
      studentsToDelete = await prisma.student.findMany({
        where: {
          program: DUGSI_PROGRAM,
          familyReferenceId: student.familyReferenceId,
        },
        select: {
          id: true,
          name: true,
          parentEmail: true,
        },
        orderBy: { createdAt: 'asc' },
      })
    } else if (student.parentEmail) {
      studentsToDelete = await prisma.student.findMany({
        where: {
          program: DUGSI_PROGRAM,
          parentEmail: student.parentEmail,
          familyReferenceId: null,
        },
        select: {
          id: true,
          name: true,
          parentEmail: true,
        },
        orderBy: { createdAt: 'asc' },
      })
    } else {
      // Single student
      studentsToDelete = [
        {
          id: student.id,
          name: '',
          parentEmail: null,
        },
      ]
    }

    return {
      success: true,
      data: {
        count: studentsToDelete.length,
        students: studentsToDelete,
      },
    }
  } catch (error) {
    console.error('Error getting delete preview:', error)
    return {
      success: false,
      error: 'Failed to get delete preview',
    }
  }
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

    // Use familyReferenceId-based matching to align with UI grouping logic
    // Priority: familyReferenceId > parentEmail > id (same as getFamilyKey)
    let deleteResult

    if (student.familyReferenceId) {
      // Delete all students with the same familyReferenceId
      deleteResult = await prisma.student.deleteMany({
        where: {
          program: DUGSI_PROGRAM,
          familyReferenceId: student.familyReferenceId,
        },
      })
    } else if (student.parentEmail) {
      // Delete all students with the same parentEmail (fallback)
      deleteResult = await prisma.student.deleteMany({
        where: {
          program: DUGSI_PROGRAM,
          parentEmail: student.parentEmail,
          familyReferenceId: null, // Only match students without familyReferenceId
        },
      })
    } else {
      // No family grouping - delete single student
      await prisma.student.delete({
        where: { id: studentId },
      })
      deleteResult = { count: 1 }
    }

    // Revalidate the page to show updated data
    revalidatePath('/admin/dugsi')

    const count = deleteResult.count
    return {
      success: true,
      message: `Successfully deleted ${count} ${count === 1 ? 'student' : 'students'}`,
    }
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

/**
 * Update parent information for entire family.
 * Updates all students in the family with the same parent information.
 */
export async function updateParentInfo(params: {
  studentId: string
  parentNumber: 1 | 2
  firstName: string
  lastName: string
  email: string
  phone: string
}): Promise<ActionResult<{ updated: number }>> {
  try {
    const { studentId, parentNumber, firstName, lastName, email, phone } =
      params

    // Validate parentNumber
    if (parentNumber !== 1 && parentNumber !== 2) {
      return {
        success: false,
        error: 'Parent number must be 1 or 2',
      }
    }

    // Get the student to find family members
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        familyReferenceId: true,
        parentEmail: true,
      },
    })

    if (!student) {
      return { success: false, error: 'Student not found' }
    }

    // Determine which parent fields to update
    const updateData =
      parentNumber === 1
        ? {
            parentFirstName: firstName,
            parentLastName: lastName,
            parentEmail: email,
            parentPhone: phone,
          }
        : {
            parent2FirstName: firstName,
            parent2LastName: lastName,
            parent2Email: email,
            parent2Phone: phone,
          }

    let updateResult

    // Use same family matching logic as other operations
    if (student.familyReferenceId) {
      // Update all students with the same familyReferenceId
      updateResult = await prisma.student.updateMany({
        where: {
          program: DUGSI_PROGRAM,
          familyReferenceId: student.familyReferenceId,
        },
        data: updateData,
      })
    } else if (student.parentEmail) {
      // Update all students with the same parentEmail (fallback)
      updateResult = await prisma.student.updateMany({
        where: {
          program: DUGSI_PROGRAM,
          parentEmail: student.parentEmail,
          familyReferenceId: null,
        },
        data: updateData,
      })
    } else {
      // No family grouping - update single student
      await prisma.student.update({
        where: { id: studentId },
        data: updateData,
      })
      updateResult = { count: 1 }
    }

    // Revalidate the page
    revalidatePath('/admin/dugsi')

    const count = updateResult.count
    return {
      success: true,
      data: { updated: count },
      message: `Successfully updated parent information for ${count} ${count === 1 ? 'student' : 'students'}`,
    }
  } catch (error) {
    console.error('Error updating parent information:', error)
    return {
      success: false,
      error: 'Failed to update parent information',
    }
  }
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
  try {
    const { studentId, firstName, lastName, email, phone } = params

    // Get the student to check if second parent exists
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        familyReferenceId: true,
        parentEmail: true,
        parent2FirstName: true,
      },
    })

    if (!student) {
      return { success: false, error: 'Student not found' }
    }

    // Check if second parent already exists
    if (student.parent2FirstName) {
      return {
        success: false,
        error: 'Second parent already exists',
      }
    }

    const updateData = {
      parent2FirstName: firstName,
      parent2LastName: lastName,
      parent2Email: email,
      parent2Phone: phone,
    }

    let updateResult

    // Use same family matching logic
    if (student.familyReferenceId) {
      updateResult = await prisma.student.updateMany({
        where: {
          program: DUGSI_PROGRAM,
          familyReferenceId: student.familyReferenceId,
        },
        data: updateData,
      })
    } else if (student.parentEmail) {
      updateResult = await prisma.student.updateMany({
        where: {
          program: DUGSI_PROGRAM,
          parentEmail: student.parentEmail,
          familyReferenceId: null,
        },
        data: updateData,
      })
    } else {
      await prisma.student.update({
        where: { id: studentId },
        data: updateData,
      })
      updateResult = { count: 1 }
    }

    // Revalidate the page
    revalidatePath('/admin/dugsi')

    const count = updateResult.count
    return {
      success: true,
      data: { updated: count },
      message: `Successfully added second parent to ${count} ${count === 1 ? 'student' : 'students'}`,
    }
  } catch (error) {
    console.error('Error adding second parent:', error)
    return {
      success: false,
      error: 'Failed to add second parent',
    }
  }
}

/**
 * Update child information for a specific student.
 * Only updates the individual child, not the whole family.
 */
export async function updateChildInfo(params: {
  studentId: string
  firstName?: string
  lastName?: string
  gender?: 'MALE' | 'FEMALE'
  dateOfBirth?: Date
  educationLevel?: EducationLevel
  gradeLevel?: GradeLevel
  schoolName?: string
  healthInfo?: string | null
}): Promise<ActionResult> {
  try {
    const { studentId, firstName, lastName, ...updateFields } = params

    // Verify student exists
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true },
    })

    if (!student) {
      return { success: false, error: 'Student not found' }
    }

    // Build update data
    const updateData: Record<string, unknown> = {}

    // Combine firstName and lastName into name if both are provided
    if (firstName !== undefined && lastName !== undefined) {
      updateData.name = formatFullName(firstName, lastName)
    }

    // Add other fields that are defined
    Object.entries(updateFields).forEach(([key, value]) => {
      if (value !== undefined) {
        updateData[key] = value
      }
    })

    // Update the student
    await prisma.student.update({
      where: { id: studentId },
      data: updateData,
    })

    // Revalidate the page
    revalidatePath('/admin/dugsi')

    return {
      success: true,
      message: 'Successfully updated child information',
    }
  } catch (error) {
    console.error('Error updating child information:', error)
    return {
      success: false,
      error: 'Failed to update child information',
    }
  }
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
  try {
    const { existingStudentId, firstName, lastName, ...childData } = params

    // Get the existing student to copy parent information
    const existingStudent = await prisma.student.findUnique({
      where: { id: existingStudentId },
      select: {
        id: true,
        familyReferenceId: true,
        parentFirstName: true,
        parentLastName: true,
        parentEmail: true,
        parentPhone: true,
        parent2FirstName: true,
        parent2LastName: true,
        parent2Email: true,
        parent2Phone: true,
      },
    })

    if (!existingStudent) {
      return { success: false, error: 'Existing student not found' }
    }

    // Combine firstName and lastName into full name
    const fullName = formatFullName(firstName, lastName)

    // Create new student with parent info from existing sibling
    const newStudent = await prisma.student.create({
      data: {
        name: fullName,
        ...childData,
        program: DUGSI_PROGRAM,
        familyReferenceId: existingStudent.familyReferenceId,
        parentFirstName: existingStudent.parentFirstName,
        parentLastName: existingStudent.parentLastName,
        parentEmail: existingStudent.parentEmail,
        parentPhone: existingStudent.parentPhone,
        parent2FirstName: existingStudent.parent2FirstName,
        parent2LastName: existingStudent.parent2LastName,
        parent2Email: existingStudent.parent2Email,
        parent2Phone: existingStudent.parent2Phone,
      },
    })

    // Revalidate the page
    revalidatePath('/admin/dugsi')

    return {
      success: true,
      data: { childId: newStudent.id },
      message: 'Successfully added child to family',
    }
  } catch (error) {
    console.error('Error adding child to family:', error)
    return {
      success: false,
      error: 'Failed to add child to family',
    }
  }
}
