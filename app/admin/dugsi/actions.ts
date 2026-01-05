'use server'

import { revalidatePath } from 'next/cache'

import { GradeLevel, Shift } from '@prisma/client'
import { z } from 'zod'

import { DUGSI_PROGRAM } from '@/lib/constants/dugsi'
import { prisma } from '@/lib/db'
import {
  getClassesWithDetails,
  getAllTeachersForAssignment,
  getAvailableStudentsForClass,
  assignTeacherToClass,
  removeTeacherFromClass,
  enrollStudentInClass,
  removeStudentFromClass,
  bulkEnrollStudents,
} from '@/lib/db/queries/dugsi-class'
import { ActionError } from '@/lib/errors/action-error'
import { createServiceLogger, logError } from '@/lib/logger'
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
  // Checkout service
  createDugsiCheckoutSession,
} from '@/lib/services/dugsi'
import {
  assignTeacherToStudent as assignTeacherToStudentService,
  reassignStudent as reassignStudentService,
  removeTeacherAssignment as removeTeacherAssignmentService,
  getTeachersByProgram as getTeachersByProgramService,
} from '@/lib/services/shared/teacher-service'
import { sendPaymentLink } from '@/lib/services/whatsapp/whatsapp-service'
import { createErrorResult } from '@/lib/utils/action-helpers'
import {
  UpdateFamilyShiftSchema,
  type UpdateFamilyShiftInput,
} from '@/lib/validations/dugsi'
import {
  AssignTeacherToClassSchema,
  RemoveTeacherFromClassSchema,
  EnrollStudentInClassSchema,
  RemoveStudentFromClassSchema,
  BulkEnrollStudentsSchema,
} from '@/lib/validations/dugsi-class'
import {
  formatPhoneForVCard,
  generateVCardsContent,
  getDateString,
  VCardContact,
  VCardResult,
} from '@/lib/vcard-export'

import {
  ActionResult,
  SubscriptionValidationData,
  PaymentStatusData,
  BankVerificationData,
  SubscriptionLinkData,
  DugsiRegistration,
  Family,
  ClassWithDetails,
  StudentForEnrollment,
} from './_types'

const logger = createServiceLogger('dugsi-admin-actions')

/**
 * Get all Dugsi registrations.
 */
export async function getDugsiRegistrations(filters?: {
  shift?: 'MORNING' | 'AFTERNOON'
}): Promise<DugsiRegistration[]> {
  return await getAllDugsiRegistrations(undefined, filters)
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
 *
 * Cancels active Stripe subscriptions, then deletes all program data.
 */
export async function deleteDugsiFamily(
  studentId: string
): Promise<
  ActionResult<{ studentsDeleted: number; subscriptionsCanceled: number }>
> {
  try {
    const result = await deleteDugsiFamilyService(studentId)
    revalidatePath('/admin/dugsi')

    const parts: string[] = []
    parts.push(
      `${result.studentsDeleted} ${result.studentsDeleted === 1 ? 'student' : 'students'}`
    )
    if (result.subscriptionsCanceled > 0) {
      parts.push(
        `${result.subscriptionsCanceled} ${result.subscriptionsCanceled === 1 ? 'subscription' : 'subscriptions'} canceled`
      )
    }

    return {
      success: true,
      data: result,
      message: `Successfully deleted ${parts.join(', ')}`,
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
 * Update shift for all children in a family.
 */
export async function updateFamilyShift(
  params: UpdateFamilyShiftInput
): Promise<ActionResult> {
  try {
    const validated = UpdateFamilyShiftSchema.parse(params)

    await prisma.programProfile.updateMany({
      where: {
        program: DUGSI_PROGRAM,
        familyReferenceId: validated.familyReferenceId,
      },
      data: {
        shift: validated.shift,
      },
    })

    revalidatePath('/admin/dugsi', 'layout')

    return {
      success: true,
      message: 'Successfully updated family shift',
    }
  } catch (error) {
    await logError(logger, error, 'Failed to update family shift', {
      familyReferenceId: params.familyReferenceId,
      attemptedShift: params.shift,
    })
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to update family shift',
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
 * Input for generating family payment link with calculated/override rate
 *
 * NOTE: childCount is NOT included - the service queries the database
 * for the authoritative child count to prevent billing manipulation.
 */
export interface GenerateFamilyPaymentLinkInput {
  familyId: string
  overrideAmount?: number
  billingStartDate?: string // ISO date string for delayed start
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
 * @param input - Family ID and optional override amount (in cents)
 * @returns Payment link data with rate information
 */
export async function generateFamilyPaymentLinkAction(
  input: GenerateFamilyPaymentLinkInput
): Promise<ActionResult<FamilyPaymentLinkData>> {
  const { familyId, overrideAmount, billingStartDate } = input

  try {
    // Override validation is handled by the checkout service (Zod schema)
    // Service also queries DB for authoritative child count

    // Call the checkout service
    const result = await createDugsiCheckoutSession({
      familyId,
      overrideAmount,
      billingStartDate,
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

/**
 * Generate vCard content for Dugsi parents.
 *
 * Fetches all registrations from DB, groups by family, and generates
 * vCard content with deduplicated parent contacts.
 */
export async function generateDugsiVCardContent(): Promise<
  ActionResult<VCardResult>
> {
  try {
    const registrations = await getAllDugsiRegistrations()

    const familyMap = new Map<string, DugsiRegistration[]>()
    for (const reg of registrations) {
      const key =
        reg.familyReferenceId ||
        reg.parentEmail?.toLowerCase() ||
        reg.parentPhone ||
        reg.id
      const list = familyMap.get(key) ?? []
      list.push(reg)
      familyMap.set(key, list)
    }

    const families: Family[] = Array.from(familyMap.entries()).map(
      ([key, members]) => {
        const first = members[0]
        return {
          familyKey: key,
          members,
          hasPayment: members.some((m) => m.paymentMethodCaptured),
          hasSubscription: members.some((m) => m.stripeSubscriptionIdDugsi),
          parentEmail: first.parentEmail,
          parentPhone: first.parentPhone,
        }
      }
    )

    const contacts: VCardContact[] = []
    const seen = new Set<string>()
    let skipped = 0

    for (const family of families) {
      const first = family.members[0]
      const childNames = family.members.map((m) => m.name).join(', ')

      const addParent = (
        firstName: string | null,
        lastName: string | null,
        email: string | null,
        phone: string | null
      ) => {
        const formattedPhone = formatPhoneForVCard(phone)
        if (!formattedPhone && !email) {
          skipped++
          return
        }

        const dedupeKey = email?.toLowerCase() || formattedPhone || ''
        if (seen.has(dedupeKey)) {
          skipped++
          return
        }
        seen.add(dedupeKey)

        contacts.push({
          firstName: firstName || '',
          lastName: lastName || '',
          fullName:
            [firstName, lastName].filter(Boolean).join(' ') || 'Dugsi Parent',
          phone: formattedPhone,
          email: email || undefined,
          organization: 'Irshad Dugsi',
          note: `Children: ${childNames}`,
        })
      }

      if (first.parentFirstName || first.parentLastName) {
        addParent(
          first.parentFirstName,
          first.parentLastName,
          first.parentEmail,
          first.parentPhone
        )
      }

      if (first.parent2FirstName || first.parent2LastName) {
        addParent(
          first.parent2FirstName,
          first.parent2LastName,
          first.parent2Email,
          first.parent2Phone
        )
      }
    }

    return {
      success: true,
      data: {
        content: generateVCardsContent(contacts),
        filename: `dugsi-parent-contacts-${getDateString()}.vcf`,
        exported: contacts.length,
        skipped,
      },
    }
  } catch (error) {
    await logError(logger, error, 'Failed to generate Dugsi vCard content')
    return createErrorResult(error, 'Failed to generate vCard content')
  }
}

// ============================================================================
// Teacher Assignment Actions (Dugsi-specific)
// ============================================================================

const assignTeacherSchema = z.object({
  teacherId: z.string().uuid(),
  studentProfileId: z.string().uuid(),
  shift: z.enum(['MORNING', 'AFTERNOON']),
})

const reassignStudentSchema = z.object({
  assignmentId: z.string().uuid(),
  newTeacherId: z.string().uuid(),
})

const removeTeacherSchema = z.object({
  assignmentId: z.string().uuid(),
})

/**
 * Assign a teacher to a Dugsi student.
 * Requires shift (MORNING or AFTERNOON).
 */
export async function assignTeacherToStudent(
  rawInput: unknown
): Promise<ActionResult<void>> {
  const parsed = assignTeacherSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { success: false, error: 'Invalid input: ' + parsed.error.message }
  }
  const input = parsed.data

  try {
    // Validate shift matches student's profile shift
    const profile = await prisma.programProfile.findUnique({
      where: { id: input.studentProfileId },
      select: { shift: true },
    })

    if (!profile) {
      return { success: false, error: 'Student profile not found' }
    }

    if (profile.shift && profile.shift !== input.shift) {
      return {
        success: false,
        error: `Cannot assign ${input.shift} teacher to ${profile.shift} student`,
      }
    }

    await assignTeacherToStudentService({
      teacherId: input.teacherId,
      programProfileId: input.studentProfileId,
      shift: input.shift as Shift,
    })

    revalidatePath('/admin/dugsi')
    revalidatePath('/admin/teachers')

    logger.info(
      {
        teacherId: input.teacherId,
        studentProfileId: input.studentProfileId,
        shift: input.shift,
      },
      'Teacher assigned to Dugsi student'
    )

    return { success: true, data: undefined }
  } catch (error) {
    await logError(logger, error, 'Failed to assign teacher to student', input)

    if (error instanceof Error && error.message.includes('not enrolled')) {
      return {
        success: false,
        error:
          'Teacher is not enrolled in Dugsi program. Please enroll them first.',
      }
    }

    if (error instanceof Error && error.message.includes('already assigned')) {
      return {
        success: false,
        error:
          'This teacher is already assigned to this student for this shift',
      }
    }

    return {
      success: false,
      error: 'Failed to assign teacher to student',
    }
  }
}

/**
 * Reassign a student to a different teacher.
 */
export async function reassignStudentToTeacher(
  rawInput: unknown
): Promise<ActionResult<void>> {
  const parsed = reassignStudentSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { success: false, error: 'Invalid input: ' + parsed.error.message }
  }
  const { assignmentId, newTeacherId } = parsed.data

  try {
    await reassignStudentService(assignmentId, newTeacherId)

    revalidatePath('/admin/dugsi')
    revalidatePath('/admin/teachers')

    logger.info(
      { assignmentId, newTeacherId },
      'Student reassigned to new teacher'
    )

    return { success: true, data: undefined }
  } catch (error) {
    await logError(logger, error, 'Failed to reassign student', {
      assignmentId,
      newTeacherId,
    })
    return {
      success: false,
      error: 'Failed to reassign student to new teacher',
    }
  }
}

/**
 * Remove a teacher assignment from a student.
 */
export async function removeTeacherFromStudent(
  rawInput: unknown
): Promise<ActionResult<void>> {
  const parsed = removeTeacherSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { success: false, error: 'Invalid input: ' + parsed.error.message }
  }
  const { assignmentId } = parsed.data

  try {
    await removeTeacherAssignmentService(assignmentId)

    revalidatePath('/admin/dugsi')
    revalidatePath('/admin/teachers')

    logger.info({ assignmentId }, 'Teacher removed from student')

    return { success: true, data: undefined }
  } catch (error) {
    await logError(logger, error, 'Failed to remove teacher from student', {
      assignmentId,
    })
    return {
      success: false,
      error: 'Failed to remove teacher assignment',
    }
  }
}

/**
 * Get teachers available for Dugsi (enrolled in DUGSI_PROGRAM).
 */
export async function getAvailableDugsiTeachers(): Promise<
  ActionResult<
    Array<{
      id: string
      name: string
      email: string | null
      phone: string | null
    }>
  >
> {
  try {
    const teachers = await getTeachersByProgramService(DUGSI_PROGRAM)

    const teacherList = teachers.map((t) => ({
      id: t.id,
      name: t.person.name,
      email:
        t.person.contactPoints?.find((cp) => cp.type === 'EMAIL')?.value ??
        null,
      phone:
        t.person.contactPoints?.find(
          (cp) => cp.type === 'PHONE' || cp.type === 'WHATSAPP'
        )?.value ?? null,
    }))

    return { success: true, data: teacherList }
  } catch (error) {
    await logError(logger, error, 'Failed to get available Dugsi teachers')
    return {
      success: false,
      error: 'Failed to load available teachers',
    }
  }
}

// ============================================================================
// Class-Teacher Assignment Actions
// ============================================================================

/**
 * Assign a teacher to a Dugsi class.
 */
export async function assignTeacherToClassAction(
  rawInput: unknown
): Promise<ActionResult<void>> {
  const parsed = AssignTeacherToClassSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message || 'Invalid input',
    }
  }
  const { classId, teacherId } = parsed.data

  try {
    await assignTeacherToClass(classId, teacherId)

    revalidatePath('/admin/dugsi/classes')
    revalidatePath('/teacher/checkin')

    logger.info({ classId, teacherId }, 'Teacher assigned to class')

    return {
      success: true,
      data: undefined,
      message: 'Teacher assigned to class',
    }
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      return {
        success: false,
        error: 'This teacher is already assigned to this class',
      }
    }

    await logError(logger, error, 'Failed to assign teacher to class', {
      classId,
      teacherId,
    })
    return {
      success: false,
      error: 'Unable to assign teacher. Please try again.',
    }
  }
}

/**
 * Remove a teacher from a Dugsi class.
 */
export async function removeTeacherFromClassAction(
  rawInput: unknown
): Promise<ActionResult<void>> {
  const parsed = RemoveTeacherFromClassSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message || 'Invalid input',
    }
  }
  const { classId, teacherId } = parsed.data

  try {
    await removeTeacherFromClass(classId, teacherId)

    revalidatePath('/admin/dugsi/classes')
    revalidatePath('/teacher/checkin')

    logger.info({ classId, teacherId }, 'Teacher removed from class')

    return {
      success: true,
      data: undefined,
      message: 'Teacher removed from class',
    }
  } catch (error) {
    await logError(logger, error, 'Failed to remove teacher from class', {
      classId,
      teacherId,
    })
    return {
      success: false,
      error: 'Unable to remove teacher. Please try again.',
    }
  }
}

/**
 * Get all Dugsi classes with their teachers and student counts.
 */
export async function getClassesWithDetailsAction(): Promise<
  ActionResult<ClassWithDetails[]>
> {
  try {
    const classes = await getClassesWithDetails()

    const result: ClassWithDetails[] = classes.map((c) => ({
      id: c.id,
      name: c.name,
      shift: c.shift,
      description: c.description,
      isActive: c.isActive,
      teachers: c.teachers.map((t) => ({
        id: t.id,
        teacherId: t.teacherId,
        teacherName: t.teacher.person.name,
      })),
      studentCount: c.students.length,
    }))

    return { success: true, data: result }
  } catch (error) {
    await logError(logger, error, 'Failed to get classes with details')
    return {
      success: false,
      error: 'Unable to load classes. Please refresh the page.',
    }
  }
}

/**
 * Get all teachers available for class assignment.
 */
export async function getAllTeachersForClassAssignmentAction(): Promise<
  ActionResult<Array<{ id: string; name: string }>>
> {
  try {
    const teachers = await getAllTeachersForAssignment()
    return { success: true, data: teachers }
  } catch (error) {
    await logError(logger, error, 'Failed to get teachers for class assignment')
    return {
      success: false,
      error: 'Unable to load teachers. Please refresh the page.',
    }
  }
}

/**
 * Get students available for enrollment in a class.
 * Filters by shift and shows enrollment status.
 */
export async function getAvailableStudentsForClassAction(input: {
  shift: Shift
}): Promise<ActionResult<StudentForEnrollment[]>> {
  try {
    const students = await getAvailableStudentsForClass(input.shift)
    return { success: true, data: students }
  } catch (error) {
    await logError(logger, error, 'Failed to get available students for class')
    return {
      success: false,
      error: 'Unable to load students. Please refresh the page.',
    }
  }
}

/**
 * Enroll a student in a Dugsi class.
 */
export async function enrollStudentInClassAction(
  rawInput: unknown
): Promise<ActionResult<void>> {
  const parsed = EnrollStudentInClassSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message || 'Invalid input',
    }
  }
  const { classId, programProfileId } = parsed.data

  try {
    await enrollStudentInClass(classId, programProfileId)

    revalidatePath('/admin/dugsi/classes')

    logger.info({ classId, programProfileId }, 'Student enrolled in class')

    return {
      success: true,
      data: undefined,
      message: 'Student enrolled in class',
    }
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      return {
        success: false,
        error: 'This student is already enrolled in a class',
      }
    }

    await logError(logger, error, 'Failed to enroll student in class', {
      classId,
      programProfileId,
    })
    return {
      success: false,
      error: 'Unable to enroll student. Please try again.',
    }
  }
}

/**
 * Remove a student from a Dugsi class.
 */
export async function removeStudentFromClassAction(
  rawInput: unknown
): Promise<ActionResult<void>> {
  const parsed = RemoveStudentFromClassSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message || 'Invalid input',
    }
  }
  const { programProfileId } = parsed.data

  try {
    await removeStudentFromClass(programProfileId)

    revalidatePath('/admin/dugsi/classes')

    logger.info({ programProfileId }, 'Student removed from class')

    return {
      success: true,
      data: undefined,
      message: 'Student removed from class',
    }
  } catch (error) {
    await logError(logger, error, 'Failed to remove student from class', {
      programProfileId,
    })
    return {
      success: false,
      error: 'Unable to remove student. Please try again.',
    }
  }
}

/**
 * Bulk enroll students in a Dugsi class.
 */
export async function bulkEnrollStudentsAction(
  rawInput: unknown
): Promise<ActionResult<{ enrolled: number; skipped: number }>> {
  const parsed = BulkEnrollStudentsSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message || 'Invalid input',
    }
  }
  const { classId, programProfileIds } = parsed.data

  try {
    const result = await bulkEnrollStudents(classId, programProfileIds)

    revalidatePath('/admin/dugsi/classes')

    logger.info({ classId, ...result }, 'Bulk enrollment completed')

    return {
      success: true,
      data: result,
      message: `Enrolled ${result.enrolled} students${result.skipped > 0 ? `, ${result.skipped} already enrolled` : ''}`,
    }
  } catch (error) {
    await logError(logger, error, 'Failed to bulk enroll students', { classId })
    return {
      success: false,
      error: 'Unable to enroll students. Please try again.',
    }
  }
}

// ============================================================================
// WhatsApp Actions
// ============================================================================

const SendPaymentLinkViaWhatsAppSchema = z.object({
  phone: z
    .string()
    .min(10, 'Phone number too short')
    .max(15, 'Phone number too long'),
  parentName: z
    .string()
    .min(1, 'Parent name required')
    .max(100, 'Parent name too long'),
  amount: z
    .number()
    .int('Amount must be an integer')
    .positive('Amount must be positive'),
  childCount: z
    .number()
    .int('Child count must be an integer')
    .positive('Child count must be positive'),
  paymentUrl: z.string().url('Invalid payment URL'),
  familyId: z.string().optional(),
  personId: z.string().optional(),
})

export type SendPaymentLinkViaWhatsAppInput = z.infer<
  typeof SendPaymentLinkViaWhatsAppSchema
>

export interface WhatsAppSendResult {
  waMessageId?: string
}

/**
 * Send a payment link to a parent via WhatsApp API.
 *
 * Uses the WhatsApp Cloud API to send a pre-approved template message
 * with the payment link. Message is logged to WhatsAppMessage table.
 *
 * Design decision: This action intentionally does NOT use a database transaction.
 * The WhatsApp message record should persist for audit trail purposes even if
 * any caller's subsequent operations fail. The message has already been sent
 * to WhatsApp's servers at that point.
 */
export async function sendPaymentLinkViaWhatsAppAction(
  rawInput: unknown
): Promise<ActionResult<WhatsAppSendResult>> {
  const parseResult = SendPaymentLinkViaWhatsAppSchema.safeParse(rawInput)
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error.errors[0]?.message || 'Invalid input',
    }
  }
  const input = parseResult.data

  const result = await sendPaymentLink({
    phone: input.phone,
    parentName: input.parentName,
    amount: input.amount,
    childCount: input.childCount,
    paymentUrl: input.paymentUrl,
    program: DUGSI_PROGRAM,
    personId: input.personId,
    familyId: input.familyId,
  })

  if (!result.success) {
    return {
      success: false,
      error: result.error || 'Failed to send WhatsApp message',
    }
  }

  revalidatePath('/admin/dugsi')

  return {
    success: true,
    data: { waMessageId: result.waMessageId },
    message: 'Payment link sent via WhatsApp',
  }
}
