'use server'

import { revalidatePath } from 'next/cache'

import { GradeLevel, Prisma, Shift } from '@prisma/client'
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
import { createServiceLogger, logError, logInfo } from '@/lib/logger'
import { adminActionClient } from '@/lib/safe-action'
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
import { UpdateFamilyShiftSchema } from '@/lib/validations/dugsi'
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

const _getDugsiRegistrations = adminActionClient
  .metadata({ actionName: 'getDugsiRegistrations' })
  .inputSchema(ShiftFilterSchema)
  .action(async ({ parsedInput }): Promise<DugsiRegistration[]> => {
    return await getAllDugsiRegistrations(undefined, parsedInput)
  })

const _generateDugsiVCardContent = adminActionClient
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

const _getAvailableDugsiTeachers = adminActionClient
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

const _getUnassignedStudentsAction = adminActionClient
  .metadata({ actionName: 'getUnassignedStudentsAction' })
  .action(async (): Promise<UnassignedStudent[]> => {
    return await getUnassignedDugsiStudents()
  })

const _getClassesWithDetailsAction = adminActionClient
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

const _getAllTeachersForClassAssignmentAction = adminActionClient
  .metadata({ actionName: 'getAllTeachersForClassAssignmentAction' })
  .action(async (): Promise<Array<{ id: string; name: string }>> => {
    return await getAllTeachersForAssignment()
  })

// ============================================================================
// Family/subscription data fetch actions (with input)
// ============================================================================

const _getFamilyMembers = adminActionClient
  .metadata({ actionName: 'getFamilyMembers' })
  .inputSchema(StudentIdSchema)
  .action(async ({ parsedInput }): Promise<DugsiRegistration[]> => {
    return await getFamilyMembersService(parsedInput.studentId)
  })

const _getDeleteFamilyPreview = adminActionClient
  .metadata({ actionName: 'getDeleteFamilyPreview' })
  .inputSchema(StudentIdSchema)
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

const _validateDugsiSubscription = adminActionClient
  .metadata({ actionName: 'validateDugsiSubscription' })
  .inputSchema(SubscriptionIdSchema)
  .action(async ({ parsedInput }): Promise<SubscriptionValidationData> => {
    return await validateDugsiSubscriptionService(parsedInput.subscriptionId)
  })

const _getDugsiPaymentStatus = adminActionClient
  .metadata({ actionName: 'getDugsiPaymentStatus' })
  .inputSchema(ParentEmailSchema)
  .action(async ({ parsedInput }): Promise<PaymentStatusData> => {
    return await getPaymentStatus(parsedInput.parentEmail)
  })

const _getFamilyPaymentHistory = adminActionClient
  .metadata({ actionName: 'getFamilyPaymentHistory' })
  .inputSchema(PaymentHistorySchema)
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

const _getAvailableStudentsForClassAction = adminActionClient
  .metadata({ actionName: 'getAvailableStudentsForClassAction' })
  .inputSchema(z.object({ shift: z.nativeEnum(Shift) }))
  .action(async ({ parsedInput }): Promise<StudentForEnrollment[]> => {
    return await getAvailableStudentsForClass(parsedInput.shift)
  })

const _getClassDeletePreviewAction = adminActionClient
  .metadata({ actionName: 'getClassDeletePreviewAction' })
  .inputSchema(ClassIdSchema)
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

const _deleteDugsiFamily = adminActionClient
  .metadata({ actionName: 'deleteDugsiFamily' })
  .inputSchema(StudentIdSchema)
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

const _linkDugsiSubscription = adminActionClient
  .metadata({ actionName: 'linkDugsiSubscription' })
  .inputSchema(LinkSubscriptionSchema)
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

const _verifyDugsiBankAccount = adminActionClient
  .metadata({ actionName: 'verifyDugsiBankAccount' })
  .inputSchema(VerifyBankSchema)
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

const _updateParentInfo = adminActionClient
  .metadata({ actionName: 'updateParentInfo' })
  .inputSchema(UpdateParentInfoSchema)
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

const _addSecondParent = adminActionClient
  .metadata({ actionName: 'addSecondParent' })
  .inputSchema(AddSecondParentSchema)
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

const _setPrimaryPayer = adminActionClient
  .metadata({ actionName: 'setPrimaryPayer' })
  .inputSchema(SetPrimaryPayerSchema)
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

const _updateChildInfo = adminActionClient
  .metadata({ actionName: 'updateChildInfo' })
  .inputSchema(UpdateChildInfoSchema)
  .action(async ({ parsedInput }): Promise<{ message: string }> => {
    await updateChildInfoService(parsedInput)
    revalidatePath('/admin/dugsi')
    return { message: 'Successfully updated child information' }
  })

const _updateFamilyShift = adminActionClient
  .metadata({ actionName: 'updateFamilyShift' })
  .inputSchema(UpdateFamilyShiftSchema)
  .action(async ({ parsedInput }): Promise<{ message: string }> => {
    await updateFamilyShiftService({
      familyReferenceId: parsedInput.familyReferenceId,
      shift: parsedInput.shift,
    })
    revalidatePath('/admin/dugsi')
    return { message: 'Successfully updated family shift' }
  })

const _addChildToFamily = adminActionClient
  .metadata({ actionName: 'addChildToFamily' })
  .inputSchema(AddChildToFamilySchema)
  .action(
    async ({ parsedInput }): Promise<{ childId: string; message: string }> => {
      const result = await addChildToFamilyService(parsedInput)
      revalidatePath('/admin/dugsi')
      return { ...result, message: 'Successfully added child to family' }
    }
  )

const _generateFamilyPaymentLinkAction = adminActionClient
  .metadata({ actionName: 'generateFamilyPaymentLinkAction' })
  .inputSchema(GenerateFamilyPaymentLinkSchema)
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

const _bulkGeneratePaymentLinksAction = adminActionClient
  .metadata({ actionName: 'bulkGeneratePaymentLinksAction' })
  .inputSchema(BulkPaymentLinksSchema)
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
            await logError(
              logger,
              error,
              'Failed to generate payment link in bulk',
              { familyId }
            )
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

const _assignTeacherToClassAction = adminActionClient
  .metadata({ actionName: 'assignTeacherToClassAction' })
  .inputSchema(AssignTeacherToClassSchema)
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
        error instanceof Prisma.PrismaClientKnownRequestError &&
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

const _removeTeacherFromClassAction = adminActionClient
  .metadata({ actionName: 'removeTeacherFromClassAction' })
  .inputSchema(RemoveTeacherFromClassSchema)
  .action(async ({ parsedInput }): Promise<{ message: string }> => {
    const { classId, teacherId } = parsedInput
    await removeTeacherFromClass(classId, teacherId)
    revalidatePath('/admin/dugsi/classes')
    revalidatePath('/teacher/checkin')
    logger.info({ classId, teacherId }, 'Teacher removed from class')
    return { message: 'Teacher removed from class' }
  })

const _enrollStudentInClassAction = adminActionClient
  .metadata({ actionName: 'enrollStudentInClassAction' })
  .inputSchema(EnrollStudentInClassSchema)
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

const _removeStudentFromClassAction = adminActionClient
  .metadata({ actionName: 'removeStudentFromClassAction' })
  .inputSchema(RemoveStudentFromClassSchema)
  .action(async ({ parsedInput }): Promise<{ message: string }> => {
    const { programProfileId } = parsedInput
    await removeStudentFromClass(programProfileId)
    revalidatePath('/admin/dugsi/classes')
    logger.info({ programProfileId }, 'Student removed from class')
    return { message: 'Student removed from class' }
  })

const _bulkEnrollStudentsAction = adminActionClient
  .metadata({ actionName: 'bulkEnrollStudentsAction' })
  .inputSchema(BulkEnrollStudentsSchema)
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

const _createClassAction = adminActionClient
  .metadata({ actionName: 'createClassAction' })
  .inputSchema(CreateClassSchema)
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

const _updateClassAction = adminActionClient
  .metadata({ actionName: 'updateClassAction' })
  .inputSchema(UpdateClassSchema)
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

const _deleteClassAction = adminActionClient
  .metadata({ actionName: 'deleteClassAction' })
  .inputSchema(DeleteClassSchema)
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

const _previewStripeSubscriptionForConsolidation = adminActionClient
  .metadata({ actionName: 'previewStripeSubscriptionForConsolidation' })
  .inputSchema(previewSubscriptionInputSchema)
  .action(async ({ parsedInput }): Promise<StripeSubscriptionPreview> => {
    return await previewStripeSubscriptionService(
      parsedInput.subscriptionId,
      parsedInput.familyId
    )
  })

const _consolidateDugsiSubscription = adminActionClient
  .metadata({ actionName: 'consolidateDugsiSubscription' })
  .inputSchema(consolidateSubscriptionInputSchema)
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

const _sendPaymentLinkViaWhatsAppAction = adminActionClient
  .metadata({ actionName: 'sendPaymentLinkViaWhatsAppAction' })
  .inputSchema(SendPaymentLinkViaWhatsAppSchema)
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

export async function getDugsiRegistrations(
  ...args: Parameters<typeof _getDugsiRegistrations>
) {
  return _getDugsiRegistrations(...args)
}
export async function generateDugsiVCardContent(
  ...args: Parameters<typeof _generateDugsiVCardContent>
) {
  return _generateDugsiVCardContent(...args)
}
export async function getAvailableDugsiTeachers(
  ...args: Parameters<typeof _getAvailableDugsiTeachers>
) {
  return _getAvailableDugsiTeachers(...args)
}
export async function getUnassignedStudentsAction(
  ...args: Parameters<typeof _getUnassignedStudentsAction>
) {
  return _getUnassignedStudentsAction(...args)
}
export async function getClassesWithDetailsAction(
  ...args: Parameters<typeof _getClassesWithDetailsAction>
) {
  return _getClassesWithDetailsAction(...args)
}
export async function getAllTeachersForClassAssignmentAction(
  ...args: Parameters<typeof _getAllTeachersForClassAssignmentAction>
) {
  return _getAllTeachersForClassAssignmentAction(...args)
}
export async function getFamilyMembers(
  ...args: Parameters<typeof _getFamilyMembers>
) {
  return _getFamilyMembers(...args)
}
export async function getDeleteFamilyPreview(
  ...args: Parameters<typeof _getDeleteFamilyPreview>
) {
  return _getDeleteFamilyPreview(...args)
}
export async function validateDugsiSubscription(
  ...args: Parameters<typeof _validateDugsiSubscription>
) {
  return _validateDugsiSubscription(...args)
}
export async function getDugsiPaymentStatus(
  ...args: Parameters<typeof _getDugsiPaymentStatus>
) {
  return _getDugsiPaymentStatus(...args)
}
export async function getFamilyPaymentHistory(
  ...args: Parameters<typeof _getFamilyPaymentHistory>
) {
  return _getFamilyPaymentHistory(...args)
}
export async function getAvailableStudentsForClassAction(
  ...args: Parameters<typeof _getAvailableStudentsForClassAction>
) {
  return _getAvailableStudentsForClassAction(...args)
}
export async function getClassDeletePreviewAction(
  ...args: Parameters<typeof _getClassDeletePreviewAction>
) {
  return _getClassDeletePreviewAction(...args)
}
export async function deleteDugsiFamily(
  ...args: Parameters<typeof _deleteDugsiFamily>
) {
  return _deleteDugsiFamily(...args)
}
export async function linkDugsiSubscription(
  ...args: Parameters<typeof _linkDugsiSubscription>
) {
  return _linkDugsiSubscription(...args)
}
export async function verifyDugsiBankAccount(
  ...args: Parameters<typeof _verifyDugsiBankAccount>
) {
  return _verifyDugsiBankAccount(...args)
}
export async function updateParentInfo(
  ...args: Parameters<typeof _updateParentInfo>
) {
  return _updateParentInfo(...args)
}
export async function addSecondParent(
  ...args: Parameters<typeof _addSecondParent>
) {
  return _addSecondParent(...args)
}
export async function setPrimaryPayer(
  ...args: Parameters<typeof _setPrimaryPayer>
) {
  return _setPrimaryPayer(...args)
}
export async function updateChildInfo(
  ...args: Parameters<typeof _updateChildInfo>
) {
  return _updateChildInfo(...args)
}
export async function updateFamilyShift(
  ...args: Parameters<typeof _updateFamilyShift>
) {
  return _updateFamilyShift(...args)
}
export async function addChildToFamily(
  ...args: Parameters<typeof _addChildToFamily>
) {
  return _addChildToFamily(...args)
}
export async function generateFamilyPaymentLinkAction(
  ...args: Parameters<typeof _generateFamilyPaymentLinkAction>
) {
  return _generateFamilyPaymentLinkAction(...args)
}
export async function bulkGeneratePaymentLinksAction(
  ...args: Parameters<typeof _bulkGeneratePaymentLinksAction>
) {
  return _bulkGeneratePaymentLinksAction(...args)
}
export async function assignTeacherToClassAction(
  ...args: Parameters<typeof _assignTeacherToClassAction>
) {
  return _assignTeacherToClassAction(...args)
}
export async function removeTeacherFromClassAction(
  ...args: Parameters<typeof _removeTeacherFromClassAction>
) {
  return _removeTeacherFromClassAction(...args)
}
export async function enrollStudentInClassAction(
  ...args: Parameters<typeof _enrollStudentInClassAction>
) {
  return _enrollStudentInClassAction(...args)
}
export async function removeStudentFromClassAction(
  ...args: Parameters<typeof _removeStudentFromClassAction>
) {
  return _removeStudentFromClassAction(...args)
}
export async function bulkEnrollStudentsAction(
  ...args: Parameters<typeof _bulkEnrollStudentsAction>
) {
  return _bulkEnrollStudentsAction(...args)
}
export async function createClassAction(
  ...args: Parameters<typeof _createClassAction>
) {
  return _createClassAction(...args)
}
export async function updateClassAction(
  ...args: Parameters<typeof _updateClassAction>
) {
  return _updateClassAction(...args)
}
export async function deleteClassAction(
  ...args: Parameters<typeof _deleteClassAction>
) {
  return _deleteClassAction(...args)
}
export async function previewStripeSubscriptionForConsolidation(
  ...args: Parameters<typeof _previewStripeSubscriptionForConsolidation>
) {
  return _previewStripeSubscriptionForConsolidation(...args)
}
export async function consolidateDugsiSubscription(
  ...args: Parameters<typeof _consolidateDugsiSubscription>
) {
  return _consolidateDugsiSubscription(...args)
}
export async function sendPaymentLinkViaWhatsAppAction(
  ...args: Parameters<typeof _sendPaymentLinkViaWhatsAppAction>
) {
  return _sendPaymentLinkViaWhatsAppAction(...args)
}
