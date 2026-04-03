'use server'

import { revalidatePath } from 'next/cache'

import { GradeLevel, Shift } from '@prisma/client'
import { z } from 'zod'

import { DUGSI_PROGRAM } from '@/lib/constants/dugsi'
import {
  getClassesWithDetails,
  getAllTeachersForAssignment,
  getAvailableStudentsForClass,
  getUnassignedDugsiStudents,
  assignTeacherToClass,
  removeTeacherFromClass,
  enrollStudentInClass,
  removeStudentFromClass,
  bulkEnrollStudents,
  createClass,
  updateClass,
  deleteClass,
  getClassById,
  getClassPreviewForDelete,
} from '@/lib/db/queries/dugsi-class'
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import {
  ClassNotFoundError,
  TeacherNotAuthorizedError,
} from '@/lib/errors/dugsi-class-errors'
import { createServiceLogger, logInfo } from '@/lib/logger'
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
  updateFamilyShift as updateFamilyShiftService,
  // Payment service
  verifyBankAccount,
  getPaymentStatus,
  // Checkout service
  createDugsiCheckoutSession,
  // Consolidate subscription service
  previewStripeSubscription as previewStripeSubscriptionService,
  consolidateStripeSubscription as consolidateStripeSubscriptionService,
  type StripeSubscriptionPreview,
  type ConsolidateSubscriptionResult,
} from '@/lib/services/dugsi'
import { getTeachersByProgram as getTeachersByProgramService } from '@/lib/services/shared/teacher-service'
import { sendPaymentLink } from '@/lib/services/whatsapp/whatsapp-service'
import { getDugsiStripeClient } from '@/lib/stripe-dugsi'
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
  CreateClassSchema,
  UpdateClassSchema,
  DeleteClassSchema,
} from '@/lib/validations/dugsi-class'
import {
  formatPhoneForVCard,
  generateVCardsContent,
  getDateString,
  VCardContact,
  VCardResult,
} from '@/lib/vcard-export'
import { adminActionClient } from '@/lib/safe-action'

import {
  previewSubscriptionInputSchema,
  consolidateSubscriptionInputSchema,
} from './_schemas/dialog-schemas'
import {
  SubscriptionValidationData,
  PaymentStatusData,
  BankVerificationData,
  SubscriptionLinkData,
  DugsiRegistration,
  Family,
  ClassWithDetails,
  StudentForEnrollment,
  StripePaymentHistoryItem,
  UnassignedStudent,
} from './_types'

const logger = createServiceLogger('dugsi-admin-actions')

// ============================================================================
// Schemas for actions that take positional string args
// ============================================================================

const StudentIdSchema = z.object({ studentId: z.string().min(1) })
const SubscriptionIdSchema = z.object({ subscriptionId: z.string().min(1) })
const ParentEmailSchema = z.object({ parentEmail: z.string().email() })
const CustomerIdSchema = z.object({ customerId: z.string().min(1) })
const ClassIdSchema = z.object({ classId: z.string().min(1) })
const ShiftFilterSchema = z.object({
  shift: z.enum(['MORNING', 'AFTERNOON']).optional(),
})

const LinkSubscriptionSchema = z.object({
  parentEmail: z.string().email(),
  subscriptionId: z.string().min(1),
})

const VerifyBankSchema = z.object({
  paymentIntentId: z.string().min(1),
  descriptorCode: z.string().min(1),
})

const UpdateParentInfoSchema = z.object({
  studentId: z.string().min(1),
  parentNumber: z.union([z.literal(1), z.literal(2)]),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().min(1),
})

const AddSecondParentSchema = z.object({
  studentId: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
})

const SetPrimaryPayerSchema = z.object({
  studentId: z.string().min(1),
  parentNumber: z.union([z.literal(1), z.literal(2)]),
})

const UpdateChildInfoSchema = z.object({
  studentId: z.string().min(1),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE']).optional(),
  dateOfBirth: z.date().optional(),
  gradeLevel: z.nativeEnum(GradeLevel).optional(),
  schoolName: z.string().optional(),
  healthInfo: z.string().nullable().optional(),
})

const AddChildToFamilySchema = z.object({
  existingStudentId: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  gender: z.enum(['MALE', 'FEMALE']),
  dateOfBirth: z.date().optional(),
  gradeLevel: z.nativeEnum(GradeLevel).optional(),
  schoolName: z.string().optional(),
  healthInfo: z.string().nullable().optional(),
})

const GenerateFamilyPaymentLinkSchema = z.object({
  familyId: z.string().min(1),
  overrideAmount: z.number().optional(),
  billingStartDate: z.string().optional(),
})

const BulkPaymentLinksSchema = z.object({
  familyIds: z.array(z.string()).min(1, 'At least one family must be selected'),
})

const PaymentHistorySchema = z.object({
  customerId: z
    .string()
    .startsWith('cus_', 'Invalid Stripe customer ID format'),
})

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

// ============================================================================
// Re-export types used by callsites
// ============================================================================

export type SendPaymentLinkViaWhatsAppInput = z.infer<
  typeof SendPaymentLinkViaWhatsAppSchema
>

export interface GenerateFamilyPaymentLinkInput {
  familyId: string
  overrideAmount?: number
  billingStartDate?: string
}

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

export interface WhatsAppSendResult {
  waMessageId?: string
}

// ============================================================================
// Data fetch actions (no schema — no input)
// ============================================================================

export const getDugsiRegistrations = adminActionClient
  .metadata({ actionName: 'getDugsiRegistrations' })
  .schema(ShiftFilterSchema)
  .action(async ({ parsedInput }): Promise<DugsiRegistration[]> => {
    return await getAllDugsiRegistrations(undefined, parsedInput)
  })

export const generateDugsiVCardContent = adminActionClient
  .metadata({ actionName: 'generateDugsiVCardContent' })
  .action(async (): Promise<VCardResult> => {
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
          hasSubscription: members.some(
            (m) =>
              m.stripeSubscriptionIdDugsi && m.subscriptionStatus === 'active'
          ),
          hasChurned: members.some(
            (m) =>
              m.stripeSubscriptionIdDugsi && m.subscriptionStatus === 'canceled'
          ),
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
      content: generateVCardsContent(contacts),
      filename: `dugsi-parent-contacts-${getDateString()}.vcf`,
      exported: contacts.length,
      skipped,
    }
  })

export const getAvailableDugsiTeachers = adminActionClient
  .metadata({ actionName: 'getAvailableDugsiTeachers' })
  .action(
    async (): Promise<
      Array<{
        id: string
        name: string
        email: string | null
        phone: string | null
      }>
    > => {
      const teachers = await getTeachersByProgramService(DUGSI_PROGRAM)
      return teachers.map((t) => ({
        id: t.id,
        name: t.person.name,
        email: t.person.email,
        phone: t.person.phone,
      }))
    }
  )

export const getUnassignedStudentsAction = adminActionClient
  .metadata({ actionName: 'getUnassignedStudentsAction' })
  .action(async (): Promise<UnassignedStudent[]> => {
    return await getUnassignedDugsiStudents()
  })

export const getClassesWithDetailsAction = adminActionClient
  .metadata({ actionName: 'getClassesWithDetailsAction' })
  .action(async (): Promise<ClassWithDetails[]> => {
    const classes = await getClassesWithDetails()
    return classes.map((c) => ({
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
  })

export const getAllTeachersForClassAssignmentAction = adminActionClient
  .metadata({ actionName: 'getAllTeachersForClassAssignmentAction' })
  .action(async (): Promise<Array<{ id: string; name: string }>> => {
    return await getAllTeachersForAssignment()
  })

// ============================================================================
// Family/subscription data fetch actions (with input)
// ============================================================================

export const getFamilyMembers = adminActionClient
  .metadata({ actionName: 'getFamilyMembers' })
  .schema(StudentIdSchema)
  .action(async ({ parsedInput }): Promise<DugsiRegistration[]> => {
    return await getFamilyMembersService(parsedInput.studentId)
  })

export const getDeleteFamilyPreview = adminActionClient
  .metadata({ actionName: 'getDeleteFamilyPreview' })
  .schema(StudentIdSchema)
  .action(
    async ({
      parsedInput,
    }): Promise<{
      count: number
      students: Array<{ id: string; name: string; parentEmail: string | null }>
    }> => {
      return await getDeleteFamilyPreviewService(parsedInput.studentId)
    }
  )

export const validateDugsiSubscription = adminActionClient
  .metadata({ actionName: 'validateDugsiSubscription' })
  .schema(SubscriptionIdSchema)
  .action(async ({ parsedInput }): Promise<SubscriptionValidationData> => {
    return await validateDugsiSubscriptionService(parsedInput.subscriptionId)
  })

export const getDugsiPaymentStatus = adminActionClient
  .metadata({ actionName: 'getDugsiPaymentStatus' })
  .schema(ParentEmailSchema)
  .action(async ({ parsedInput }): Promise<PaymentStatusData> => {
    return await getPaymentStatus(parsedInput.parentEmail)
  })

export const getFamilyPaymentHistory = adminActionClient
  .metadata({ actionName: 'getFamilyPaymentHistory' })
  .schema(PaymentHistorySchema)
  .action(async ({ parsedInput }): Promise<StripePaymentHistoryItem[]> => {
    const stripe = getDugsiStripeClient()
    const invoices = await stripe.invoices.list({
      customer: parsedInput.customerId,
      limit: 50,
    })

    return invoices.data
      .filter(
        (invoice): invoice is typeof invoice & { id: string } => !!invoice.id
      )
      .map((invoice) => ({
        id: invoice.id,
        date: new Date(invoice.created * 1000),
        amount: invoice.total ?? invoice.amount_paid,
        status:
          invoice.status === 'paid'
            ? 'succeeded'
            : invoice.status === 'open'
              ? 'pending'
              : 'failed',
        description:
          invoice.description ||
          `Invoice for ${invoice.lines.data[0]?.description || 'subscription'}`,
        invoiceUrl: invoice.hosted_invoice_url ?? null,
      }))
  })

export const getAvailableStudentsForClassAction = adminActionClient
  .metadata({ actionName: 'getAvailableStudentsForClassAction' })
  .schema(z.object({ shift: z.nativeEnum(Shift) }))
  .action(async ({ parsedInput }): Promise<StudentForEnrollment[]> => {
    return await getAvailableStudentsForClass(parsedInput.shift)
  })

export const getClassDeletePreviewAction = adminActionClient
  .metadata({ actionName: 'getClassDeletePreviewAction' })
  .schema(ClassIdSchema)
  .action(
    async ({
      parsedInput,
    }): Promise<{ teacherCount: number; studentCount: number }> => {
      const preview = await getClassPreviewForDelete(parsedInput.classId)
      if (!preview) {
        throw new ActionError(
          'Class not found',
          ERROR_CODES.NOT_FOUND,
          undefined,
          404
        )
      }
      return preview
    }
  )

// ============================================================================
// Mutation actions
// ============================================================================

export const deleteDugsiFamily = adminActionClient
  .metadata({ actionName: 'deleteDugsiFamily' })
  .schema(StudentIdSchema)
  .action(
    async ({
      parsedInput,
    }): Promise<{
      studentsDeleted: number
      subscriptionsCanceled: number
      message: string
    }> => {
      const result = await deleteDugsiFamilyService(parsedInput.studentId)
      revalidatePath('/admin/dugsi')

      await logInfo(logger, 'Dugsi family deleted', {
        studentId: parsedInput.studentId,
        studentsDeleted: result.studentsDeleted,
        subscriptionsCanceled: result.subscriptionsCanceled,
      })

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
        ...result,
        message: `Successfully deleted ${parts.join(', ')}`,
      }
    }
  )

export const linkDugsiSubscription = adminActionClient
  .metadata({ actionName: 'linkDugsiSubscription' })
  .schema(LinkSubscriptionSchema)
  .action(
    async ({
      parsedInput,
    }): Promise<SubscriptionLinkData & { message: string }> => {
      const { parentEmail, subscriptionId } = parsedInput

      if (!parentEmail || parentEmail.trim() === '') {
        throw new ActionError(
          'Parent email is required to link subscription.',
          ERROR_CODES.VALIDATION_ERROR
        )
      }

      const result = await linkDugsiSubscriptionService(
        parentEmail,
        subscriptionId
      )
      revalidatePath('/admin/dugsi')

      await logInfo(logger, 'Dugsi subscription linked', {
        parentEmail,
        subscriptionId,
        studentsUpdated: result.updated,
      })

      return {
        ...result,
        message: `Successfully linked subscription to ${result.updated} students`,
      }
    }
  )

export const verifyDugsiBankAccount = adminActionClient
  .metadata({ actionName: 'verifyDugsiBankAccount' })
  .schema(VerifyBankSchema)
  .action(async ({ parsedInput }): Promise<BankVerificationData> => {
    const { paymentIntentId, descriptorCode } = parsedInput

    if (!paymentIntentId || !paymentIntentId.startsWith('pi_')) {
      throw new ActionError(
        'Invalid payment intent ID format. Must start with "pi_"',
        ERROR_CODES.VALIDATION_ERROR
      )
    }

    const cleanCode = descriptorCode.trim().toUpperCase()
    if (!/^SM[A-Z0-9]{4}$/.test(cleanCode)) {
      throw new ActionError(
        'Invalid descriptor code format. Must be 6 characters starting with SM (e.g., SMT86W)',
        ERROR_CODES.VALIDATION_ERROR
      )
    }

    try {
      const result = await verifyBankAccount(paymentIntentId, cleanCode)
      revalidatePath('/admin/dugsi')
      return result
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'type' in error &&
        error.type === 'StripeInvalidRequestError' &&
        'code' in error
      ) {
        if (error.code === 'payment_intent_unexpected_state') {
          throw new ActionError(
            'This bank account has already been verified',
            ERROR_CODES.STRIPE_ERROR
          )
        }
        if (error.code === 'incorrect_code') {
          throw new ActionError(
            'Incorrect verification code. Please check the code in the bank statement and try again',
            ERROR_CODES.STRIPE_ERROR
          )
        }
        if (error.code === 'resource_missing') {
          throw new ActionError(
            'Payment intent not found. The verification may have expired',
            ERROR_CODES.NOT_FOUND
          )
        }
      }
      throw error
    }
  })

export const updateParentInfo = adminActionClient
  .metadata({ actionName: 'updateParentInfo' })
  .schema(UpdateParentInfoSchema)
  .action(
    async ({ parsedInput }): Promise<{ updated: number; message: string }> => {
      const result = await updateParentInfoService(parsedInput)
      revalidatePath('/admin/dugsi')
      return {
        ...result,
        message: `Successfully updated parent information for ${result.updated} ${result.updated === 1 ? 'student' : 'students'}`,
      }
    }
  )

export const addSecondParent = adminActionClient
  .metadata({ actionName: 'addSecondParent' })
  .schema(AddSecondParentSchema)
  .action(
    async ({ parsedInput }): Promise<{ updated: number; message: string }> => {
      const result = await addSecondParentService(parsedInput)
      revalidatePath('/admin/dugsi')
      return {
        ...result,
        message: `Successfully added second parent to ${result.updated} ${result.updated === 1 ? 'student' : 'students'}`,
      }
    }
  )

export const setPrimaryPayer = adminActionClient
  .metadata({ actionName: 'setPrimaryPayer' })
  .schema(SetPrimaryPayerSchema)
  .action(
    async ({ parsedInput }): Promise<{ updated: number; message: string }> => {
      const result = await setPrimaryPayerService(parsedInput)
      revalidatePath('/admin/dugsi')
      return {
        ...result,
        message: `Parent ${parsedInput.parentNumber} is now the primary payer`,
      }
    }
  )

export const updateChildInfo = adminActionClient
  .metadata({ actionName: 'updateChildInfo' })
  .schema(UpdateChildInfoSchema)
  .action(async ({ parsedInput }): Promise<{ message: string }> => {
    await updateChildInfoService(parsedInput)
    revalidatePath('/admin/dugsi')
    return { message: 'Successfully updated child information' }
  })

export const updateFamilyShift = adminActionClient
  .metadata({ actionName: 'updateFamilyShift' })
  .schema(UpdateFamilyShiftSchema)
  .action(async ({ parsedInput }): Promise<{ message: string }> => {
    await updateFamilyShiftService({
      familyReferenceId: parsedInput.familyReferenceId,
      shift: parsedInput.shift,
    })
    revalidatePath('/admin/dugsi')
    return { message: 'Successfully updated family shift' }
  })

export const addChildToFamily = adminActionClient
  .metadata({ actionName: 'addChildToFamily' })
  .schema(AddChildToFamilySchema)
  .action(
    async ({ parsedInput }): Promise<{ childId: string; message: string }> => {
      const result = await addChildToFamilyService(parsedInput)
      revalidatePath('/admin/dugsi')
      return { ...result, message: 'Successfully added child to family' }
    }
  )

export const generateFamilyPaymentLinkAction = adminActionClient
  .metadata({ actionName: 'generateFamilyPaymentLinkAction' })
  .schema(GenerateFamilyPaymentLinkSchema)
  .action(async ({ parsedInput }): Promise<FamilyPaymentLinkData> => {
    const { familyId, overrideAmount, billingStartDate } = parsedInput
    const result = await createDugsiCheckoutSession({
      familyId,
      overrideAmount,
      billingStartDate,
    })

    await logInfo(logger, 'Payment link generated', {
      familyId,
      familyName: result.familyName,
      childCount: result.childCount,
      finalRate: result.finalRate,
      isOverride: result.isOverride,
    })

    return {
      paymentUrl: result.url,
      calculatedRate: result.calculatedRate,
      finalRate: result.finalRate,
      isOverride: result.isOverride,
      rateDescription: result.rateDescription,
      tierDescription: result.tierDescription,
      familyName: result.familyName,
      childCount: result.childCount,
    }
  })

export const bulkGeneratePaymentLinksAction = adminActionClient
  .metadata({ actionName: 'bulkGeneratePaymentLinksAction' })
  .schema(BulkPaymentLinksSchema)
  .action(
    async ({
      parsedInput,
    }): Promise<{
      links: Array<{
        familyId: string
        familyName: string
        paymentUrl: string
        childCount: number
        rate: number
      }>
      failed: Array<{
        familyId: string
        familyName: string
        error: string
      }>
    }> => {
      const links: Array<{
        familyId: string
        familyName: string
        paymentUrl: string
        childCount: number
        rate: number
      }> = []
      const failed: Array<{
        familyId: string
        familyName: string
        error: string
      }> = []

      const BATCH_SIZE = 5
      const familyIds = parsedInput.familyIds

      for (let i = 0; i < familyIds.length; i += BATCH_SIZE) {
        const batch = familyIds.slice(i, i + BATCH_SIZE)

        const results = await Promise.allSettled(
          batch.map((familyId) => createDugsiCheckoutSession({ familyId }))
        )

        for (let j = 0; j < results.length; j++) {
          const familyId = batch[j]
          const result = results[j]

          if (result.status === 'fulfilled') {
            const value = result.value
            links.push({
              familyId,
              familyName: value.familyName,
              paymentUrl: value.url,
              childCount: value.childCount,
              rate: value.finalRate,
            })
          } else {
            const error = result.reason
            failed.push({
              familyId,
              familyName: familyId,
              error: error instanceof Error ? error.message : 'Unknown error',
            })
          }
        }
      }

      if (links.length === 0 && failed.length > 0) {
        throw new ActionError(
          `Failed to generate payment links for ${failed.length} ${failed.length === 1 ? 'family' : 'families'}`,
          ERROR_CODES.STRIPE_ERROR
        )
      }

      return { links, failed }
    }
  )

// ============================================================================
// Class-Teacher Assignment Actions
// ============================================================================

export const assignTeacherToClassAction = adminActionClient
  .metadata({ actionName: 'assignTeacherToClassAction' })
  .schema(AssignTeacherToClassSchema)
  .action(async ({ parsedInput }): Promise<{ message: string }> => {
    const { classId, teacherId } = parsedInput
    try {
      await assignTeacherToClass(classId, teacherId)
    } catch (error) {
      if (error instanceof ClassNotFoundError) {
        throw new ActionError(
          'Class not found or has been deactivated',
          ERROR_CODES.NOT_FOUND
        )
      }
      if (error instanceof TeacherNotAuthorizedError) {
        throw new ActionError(
          'Teacher must be enrolled in Dugsi program before assignment',
          ERROR_CODES.UNAUTHORIZED
        )
      }
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ActionError(
          'This teacher is already assigned to this class',
          ERROR_CODES.VALIDATION_ERROR
        )
      }
      throw error
    }

    revalidatePath('/admin/dugsi/classes')
    revalidatePath('/teacher/checkin')
    logger.info({ classId, teacherId }, 'Teacher assigned to class')
    return { message: 'Teacher assigned to class' }
  })

export const removeTeacherFromClassAction = adminActionClient
  .metadata({ actionName: 'removeTeacherFromClassAction' })
  .schema(RemoveTeacherFromClassSchema)
  .action(async ({ parsedInput }): Promise<{ message: string }> => {
    const { classId, teacherId } = parsedInput
    await removeTeacherFromClass(classId, teacherId)
    revalidatePath('/admin/dugsi/classes')
    revalidatePath('/teacher/checkin')
    logger.info({ classId, teacherId }, 'Teacher removed from class')
    return { message: 'Teacher removed from class' }
  })

export const enrollStudentInClassAction = adminActionClient
  .metadata({ actionName: 'enrollStudentInClassAction' })
  .schema(EnrollStudentInClassSchema)
  .action(async ({ parsedInput }): Promise<{ message: string }> => {
    const { classId, programProfileId } = parsedInput
    try {
      await enrollStudentInClass(classId, programProfileId)
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ActionError(
          'This student is already enrolled in a class',
          ERROR_CODES.VALIDATION_ERROR
        )
      }
      throw error
    }
    revalidatePath('/admin/dugsi/classes')
    logger.info({ classId, programProfileId }, 'Student enrolled in class')
    return { message: 'Student enrolled in class' }
  })

export const removeStudentFromClassAction = adminActionClient
  .metadata({ actionName: 'removeStudentFromClassAction' })
  .schema(RemoveStudentFromClassSchema)
  .action(async ({ parsedInput }): Promise<{ message: string }> => {
    const { programProfileId } = parsedInput
    await removeStudentFromClass(programProfileId)
    revalidatePath('/admin/dugsi/classes')
    logger.info({ programProfileId }, 'Student removed from class')
    return { message: 'Student removed from class' }
  })

export const bulkEnrollStudentsAction = adminActionClient
  .metadata({ actionName: 'bulkEnrollStudentsAction' })
  .schema(BulkEnrollStudentsSchema)
  .action(
    async ({
      parsedInput,
    }): Promise<{ enrolled: number; moved: number; message: string }> => {
      const { classId, programProfileIds } = parsedInput
      const result = await bulkEnrollStudents(classId, programProfileIds)
      revalidatePath('/admin/dugsi/classes')
      logger.info(
        { classId, enrolled: result.enrolled, moved: result.moved },
        'Bulk enrollment completed'
      )
      return {
        ...result,
        message: `Enrolled ${result.enrolled} students${result.moved > 0 ? ` (${result.moved} moved from other classes)` : ''}`,
      }
    }
  )

export const createClassAction = adminActionClient
  .metadata({ actionName: 'createClassAction' })
  .schema(CreateClassSchema)
  .action(
    async ({
      parsedInput,
    }): Promise<ClassWithDetails & { message: string }> => {
      const { name, shift, description } = parsedInput
      try {
        const newClass = await createClass(name, shift as Shift, description)
        revalidatePath('/admin/dugsi/classes')
        revalidatePath('/teacher/checkin')
        logger.info({ classId: newClass.id, name, shift }, 'Class created')
        return {
          id: newClass.id,
          name: newClass.name,
          shift: newClass.shift,
          description: newClass.description,
          isActive: newClass.isActive,
          teachers: [],
          studentCount: 0,
          message: 'Class created successfully',
        }
      } catch (error) {
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'P2002'
        ) {
          throw new ActionError(
            'A class with this name already exists for this shift',
            ERROR_CODES.VALIDATION_ERROR
          )
        }
        throw error
      }
    }
  )

export const updateClassAction = adminActionClient
  .metadata({ actionName: 'updateClassAction' })
  .schema(UpdateClassSchema)
  .action(
    async ({
      parsedInput,
    }): Promise<ClassWithDetails & { message: string }> => {
      const { classId, name, description } = parsedInput
      try {
        await updateClass(classId, { name, description })
      } catch (error) {
        if (error instanceof ClassNotFoundError) {
          throw new ActionError(
            'Class not found or has been deactivated',
            ERROR_CODES.NOT_FOUND
          )
        }
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'P2002'
        ) {
          throw new ActionError(
            'A class with this name already exists',
            ERROR_CODES.VALIDATION_ERROR
          )
        }
        throw error
      }

      const updatedClass = await getClassById(classId)
      if (!updatedClass) {
        throw new ActionError(
          'Class not found',
          ERROR_CODES.NOT_FOUND,
          undefined,
          404
        )
      }

      revalidatePath('/admin/dugsi/classes')
      revalidatePath('/teacher/checkin')
      logger.info({ classId, name }, 'Class updated')

      return {
        id: updatedClass.id,
        name: updatedClass.name,
        shift: updatedClass.shift,
        description: updatedClass.description,
        isActive: updatedClass.isActive,
        teachers: updatedClass.teachers.map((t) => ({
          id: t.id,
          teacherId: t.teacherId,
          teacherName: t.teacher.person.name,
        })),
        studentCount: updatedClass.students.length,
        message: 'Class updated successfully',
      }
    }
  )

export const deleteClassAction = adminActionClient
  .metadata({ actionName: 'deleteClassAction' })
  .schema(DeleteClassSchema)
  .action(async ({ parsedInput }): Promise<{ message: string }> => {
    const { classId } = parsedInput
    try {
      await deleteClass(classId)
    } catch (error) {
      if (error instanceof ClassNotFoundError) {
        throw new ActionError(
          'Class not found or has been deactivated',
          ERROR_CODES.NOT_FOUND
        )
      }
      throw error
    }
    revalidatePath('/admin/dugsi/classes')
    revalidatePath('/teacher/checkin')
    logger.info({ classId }, 'Class deleted')
    return { message: 'Class deleted successfully' }
  })

// ============================================================================
// Consolidate Subscription Actions
// ============================================================================

export const previewStripeSubscriptionForConsolidation = adminActionClient
  .metadata({ actionName: 'previewStripeSubscriptionForConsolidation' })
  .schema(previewSubscriptionInputSchema)
  .action(async ({ parsedInput }): Promise<StripeSubscriptionPreview> => {
    return await previewStripeSubscriptionService(
      parsedInput.subscriptionId,
      parsedInput.familyId
    )
  })

export const consolidateDugsiSubscription = adminActionClient
  .metadata({ actionName: 'consolidateDugsiSubscription' })
  .schema(consolidateSubscriptionInputSchema)
  .action(
    async ({
      parsedInput,
    }): Promise<ConsolidateSubscriptionResult & { message: string }> => {
      const result = await consolidateStripeSubscriptionService(parsedInput)
      revalidatePath('/admin/dugsi')

      await logInfo(logger, 'Dugsi subscription consolidated', {
        subscriptionId: parsedInput.stripeSubscriptionId,
        familyId: parsedInput.familyId,
        assignmentsCreated: result.assignmentsCreated,
        stripeCustomerSynced: result.stripeCustomerSynced,
        previousFamilyUnlinked: result.previousFamilyUnlinked,
      })

      const parts: string[] = []
      parts.push('Subscription linked')
      if (result.assignmentsCreated > 0) {
        parts.push(
          `${result.assignmentsCreated} ${result.assignmentsCreated === 1 ? 'child' : 'children'} assigned`
        )
      }
      if (result.stripeCustomerSynced) {
        parts.push('Stripe customer synced')
      } else if (result.syncError) {
        parts.push(`Stripe sync failed: ${result.syncError}`)
      }
      if (result.previousFamilyUnlinked) {
        parts.push('moved from previous family')
      }

      return { ...result, message: parts.join(', ') }
    }
  )

// ============================================================================
// WhatsApp Actions
// ============================================================================

export const sendPaymentLinkViaWhatsAppAction = adminActionClient
  .metadata({ actionName: 'sendPaymentLinkViaWhatsAppAction' })
  .schema(SendPaymentLinkViaWhatsAppSchema)
  .action(
    async ({
      parsedInput,
    }): Promise<WhatsAppSendResult & { message: string }> => {
      const result = await sendPaymentLink({
        phone: parsedInput.phone,
        parentName: parsedInput.parentName,
        amount: parsedInput.amount,
        childCount: parsedInput.childCount,
        paymentUrl: parsedInput.paymentUrl,
        program: DUGSI_PROGRAM,
        personId: parsedInput.personId,
        familyId: parsedInput.familyId,
      })

      if (!result.success) {
        throw new ActionError(
          result.error || 'Failed to send WhatsApp message',
          ERROR_CODES.SERVER_ERROR
        )
      }

      revalidatePath('/admin/dugsi')
      return {
        waMessageId: result.waMessageId,
        message: 'Payment link sent via WhatsApp',
      }
    }
  )
