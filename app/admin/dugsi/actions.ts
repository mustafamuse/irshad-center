'use server'

/**
 * Dugsi Admin Server Actions
 *
 * Server Actions for Dugsi program administration.
 * This file contains ONLY validation and orchestration logic.
 * All business logic has been extracted to lib/services/dugsi/
 * All data transformation has been extracted to lib/mappers/dugsi-mapper.ts
 *
 * Architecture:
 * - Actions: Validation + orchestration (this file)
 * - Services: Business logic (lib/services/dugsi/)
 * - Mappers: Data transformation (lib/mappers/dugsi-mapper.ts)
 * - Queries: Data access (lib/db/queries/)
 */

import { revalidatePath } from 'next/cache'

import { EducationLevel, GradeLevel } from '@prisma/client'

import { prisma } from '@/lib/db'
import { updateEnrollmentStatus } from '@/lib/db/queries/enrollment'
import {
  getProgramProfileById,
  getProgramProfilesByFamilyId,
} from '@/lib/db/queries/program-profile'
import { createActionLogger } from '@/lib/logger'
import {
  updateParentInfo as updateParentInfoService,
  addSecondParent as addSecondParentService,
  updateChildInfo as updateChildInfoService,
  addChildToFamily as addChildToFamilyService,
} from '@/lib/services/dugsi/family-service'
import {
  verifyBankAccount,
  getPaymentStatus,
  generatePaymentLink as generatePaymentLinkService,
} from '@/lib/services/dugsi/payment-service'
import {
  getAllDugsiRegistrations,
  getFamilyMembers as getFamilyMembersService,
  getDeleteFamilyPreview as getDeleteFamilyPreviewService,
  deleteDugsiFamily as _deleteDugsiEntityService,
} from '@/lib/services/dugsi/registration-service'
import {
  validateDugsiSubscription as validateSubscriptionService,
  linkDugsiSubscription as linkSubscriptionService,
} from '@/lib/services/dugsi/subscription-service'

import {
  ActionResult,
  SubscriptionValidationData,
  PaymentStatusData,
  BankVerificationData,
  SubscriptionLinkData,
  DugsiRegistration,
} from './_types'
import {
  validateDugsiEmail,
  validateDugsiProfile as _validateDugsiProfile,
  validatePaymentIntentId,
  validateDescriptorCode,
} from './_utils/validation'

const logger = createActionLogger('dugsi-actions')

/**
 * Get all Dugsi registrations.
 *
 * Returns all program profiles for the Dugsi program with full relations.
 *
 * @returns Array of DugsiRegistration DTOs
 */
export async function getDugsiRegistrations(): Promise<DugsiRegistration[]> {
  return await getAllDugsiRegistrations()
}

/**
 * Validate a Stripe subscription ID without linking it.
 *
 * Used by the link subscription dialog to check if a subscription exists
 * before attempting to link it to a family.
 *
 * @param subscriptionId - Stripe subscription ID
 * @returns Validation result with subscription details
 */
export async function validateDugsiSubscription(
  subscriptionId: string
): Promise<ActionResult<SubscriptionValidationData>> {
  try {
    const result = await validateSubscriptionService(subscriptionId)
    return {
      success: true,
      data: result,
    }
  } catch (error) {
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
 * Get all family members for a given student.
 *
 * If student has a familyReferenceId, returns all students in that family.
 * Otherwise, returns just the single student.
 *
 * @param studentId - ProgramProfile ID
 * @returns Array of family member registrations
 */
export async function getFamilyMembers(
  studentId: string
): Promise<DugsiRegistration[]> {
  return await getFamilyMembersService(studentId)
}

/**
 * Get a preview of students that will be deleted when deleting a family.
 *
 * Used by delete confirmation dialogs to show the impact of deletion.
 *
 * @param studentId - ID of any student in the family
 * @returns Preview with count and student details
 */
export async function getDeleteFamilyPreview(studentId: string): Promise<
  ActionResult<{
    count: number
    students: Array<{ id: string; name: string; parentEmail: string | null }>
  }>
> {
  try {
    const preview = await getDeleteFamilyPreviewService(studentId)
    return {
      success: true,
      data: preview,
    }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to get delete preview',
    }
  }
}

/**
 * Delete an entire Dugsi family.
 *
 * Performs soft delete by withdrawing all enrollments for all family members.
 * Uses transaction to ensure all family members are deleted atomically.
 *
 * @param studentId - ID of any student in the family
 * @returns ActionResult indicating success or failure
 */
export async function deleteDugsiFamily(
  studentId: string
): Promise<ActionResult> {
  try {
    const profile = await getProgramProfileById(studentId)
    if (!profile || profile.program !== 'DUGSI_PROGRAM') {
      return {
        success: false,
        error: 'Student not found',
      }
    }

    const familyId = profile.familyReferenceId

    // Get all family member IDs to delete
    let profileIdsToDelete = [profile.id]
    if (familyId) {
      const familyProfiles = await getProgramProfilesByFamilyId(familyId)
      profileIdsToDelete = familyProfiles.map((p) => p.id)
    }

    // Soft delete by withdrawing all enrollments in a transaction
    await prisma.$transaction(async (tx) => {
      // Update all enrollments for the profiles being deleted
      await tx.enrollment.updateMany({
        where: {
          programProfileId: { in: profileIdsToDelete },
          status: { not: 'WITHDRAWN' },
          endDate: null,
        },
        data: {
          status: 'WITHDRAWN',
          notes: 'Family deleted by admin',
        },
      })
    })

    revalidatePath('/admin/dugsi')

    return {
      success: true,
    }
  } catch (error) {
    logger.error(
      { err: error instanceof Error ? error : new Error(String(error)) },
      'Error deleting Dugsi family'
    )
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete family',
    }
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
    // Validate email format
    const emailError = validateDugsiEmail(params.parentEmail)
    if (emailError) {
      return { success: false, error: emailError }
    }

    // Use subscription service to link subscription
    const result = await linkSubscriptionService(
      params.parentEmail,
      params.subscriptionId
    )

    revalidatePath('/admin/dugsi')

    return {
      success: true,
      data: {
        updated: result.updated,
      },
    }
  } catch (error) {
    logger.error(
      { err: error instanceof Error ? error : new Error(String(error)) },
      'Error linking Dugsi subscription'
    )
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
    // Validate email format
    const emailError = validateDugsiEmail(parentEmail)
    if (emailError) {
      return { success: false, error: emailError }
    }

    // Use payment service to get status
    const paymentStatus = await getPaymentStatus(parentEmail)

    return {
      success: true,
      data: paymentStatus,
    }
  } catch (error) {
    logger.error(
      { err: error instanceof Error ? error : new Error(String(error)) },
      'Error getting Dugsi payment status'
    )
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to get payment status',
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
    // Validate payment intent ID
    const paymentIntentError = validatePaymentIntentId(paymentIntentId)
    if (paymentIntentError) {
      return { success: false, error: paymentIntentError }
    }

    // Validate descriptor code format
    const { error: codeError, cleanCode } =
      validateDescriptorCode(descriptorCode)
    if (codeError) {
      return { success: false, error: codeError }
    }

    // Use payment service to verify bank account
    const result = await verifyBankAccount(paymentIntentId, cleanCode)

    // Revalidate the dashboard to reflect updated payment status
    revalidatePath('/admin/dugsi')

    return {
      success: true,
      data: result,
    }
  } catch (error: unknown) {
    logger.error(
      { err: error instanceof Error ? error : new Error(String(error)) },
      'Error verifying bank account'
    )

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
  try {
    // Use family service to update parent info
    const result = await updateParentInfoService(params)

    revalidatePath('/admin/dugsi')

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    logger.error(
      { err: error instanceof Error ? error : new Error(String(error)) },
      'Error updating parent info'
    )
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to update parent info',
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
    // Validate email format
    const emailError = validateDugsiEmail(params.email)
    if (emailError) {
      return { success: false, error: emailError }
    }

    // Use family service to add second parent
    const result = await addSecondParentService(params)

    revalidatePath('/admin/dugsi')

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    logger.error(
      { err: error instanceof Error ? error : new Error(String(error)) },
      'Error adding second parent'
    )
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to add second parent',
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
  dateOfBirth?: Date
  gender?: 'MALE' | 'FEMALE'
  educationLevel?: EducationLevel
  gradeLevel?: GradeLevel
  schoolName?: string
  healthInfo?: string | null
}): Promise<ActionResult> {
  try {
    // Use family service to update child info
    await updateChildInfoService(params)

    revalidatePath('/admin/dugsi')

    return {
      success: true,
    }
  } catch (error) {
    logger.error(
      { err: error instanceof Error ? error : new Error(String(error)) },
      'Error updating child info'
    )
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to update child info',
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
    // Use family service to add child
    const result = await addChildToFamilyService(params)

    revalidatePath('/admin/dugsi')

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    logger.error(
      { err: error instanceof Error ? error : new Error(String(error)) },
      'Error adding child to family'
    )
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
 * Update a Dugsi registration (ProgramProfile + Enrollment)
 */
export async function updateDugsiRegistration(
  studentId: string,
  updates: {
    status?: 'REGISTERED' | 'ENROLLED' | 'WITHDRAWN'
    educationLevel?: EducationLevel
    gradeLevel?: GradeLevel
    schoolName?: string
    healthInfo?: string | null
  }
): Promise<ActionResult> {
  try {
    const profile = await getProgramProfileById(studentId)
    if (!profile || profile.program !== 'DUGSI_PROGRAM') {
      return {
        success: false,
        error: 'Student not found',
      }
    }

    // Update ProgramProfile
    const profileUpdates: Partial<{
      educationLevel: EducationLevel
      gradeLevel: GradeLevel
      schoolName: string | null
      healthInfo: string | null
      status: 'REGISTERED' | 'ENROLLED' | 'WITHDRAWN'
    }> = {}

    if (updates.educationLevel !== undefined)
      profileUpdates.educationLevel = updates.educationLevel
    if (updates.gradeLevel !== undefined)
      profileUpdates.gradeLevel = updates.gradeLevel
    if (updates.schoolName !== undefined)
      profileUpdates.schoolName = updates.schoolName || null
    if (updates.healthInfo !== undefined)
      profileUpdates.healthInfo = updates.healthInfo
    if (updates.status !== undefined) profileUpdates.status = updates.status

    if (Object.keys(profileUpdates).length > 0) {
      await prisma.programProfile.update({
        where: { id: studentId },
        data: profileUpdates,
      })
    }

    // Update Enrollment status if provided
    if (updates.status !== undefined) {
      const activeEnrollment = profile.enrollments?.find(
        (e) => e.status !== 'WITHDRAWN' && !e.endDate
      )
      if (activeEnrollment) {
        await updateEnrollmentStatus(
          activeEnrollment.id,
          updates.status,
          'Updated by admin'
        )
      }
    }

    revalidatePath('/admin/dugsi')

    return {
      success: true,
    }
  } catch (error) {
    logger.error(
      { err: error instanceof Error ? error : new Error(String(error)) },
      'Error updating Dugsi registration'
    )
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to update registration',
    }
  }
}

/**
 * Delete a Dugsi registration (soft delete via Enrollment.status = 'WITHDRAWN')
 */
export async function deleteDugsiRegistration(
  studentId: string
): Promise<ActionResult> {
  try {
    const profile = await getProgramProfileById(studentId)
    if (!profile || profile.program !== 'DUGSI_PROGRAM') {
      return {
        success: false,
        error: 'Student not found',
      }
    }

    // Soft delete by withdrawing all enrollments
    const enrollments = profile.enrollments || []
    for (const enrollment of enrollments) {
      if (enrollment.status !== 'WITHDRAWN' && !enrollment.endDate) {
        await updateEnrollmentStatus(
          enrollment.id,
          'WITHDRAWN',
          'Deleted by admin'
        )
      }
    }

    // Update profile status
    await prisma.programProfile.update({
      where: { id: studentId },
      data: { status: 'WITHDRAWN' },
    })

    revalidatePath('/admin/dugsi')

    return {
      success: true,
    }
  } catch (error) {
    logger.error(
      { err: error instanceof Error ? error : new Error(String(error)) },
      'Error deleting Dugsi registration'
    )
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to delete registration',
    }
  }
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
    // Use payment service to generate link
    const paymentLink = await generatePaymentLinkService(
      studentId,
      familyMembers
    )

    return {
      success: true,
      data: paymentLink,
    }
  } catch (error) {
    logger.error(
      { err: error instanceof Error ? error : new Error(String(error)) },
      'Error generating payment link'
    )
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to generate payment link'
    return {
      success: false,
      error: errorMessage,
    }
  }
}
