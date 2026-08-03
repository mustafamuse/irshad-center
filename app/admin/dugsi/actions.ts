'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { after } from 'next/server'

import { GradeLevel, Prisma, Shift, SubscriptionStatus } from '@prisma/client'
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
import {
  adminActionClient,
  rateLimitedAdminActionClient,
} from '@/lib/safe-action'
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
  reEnrollChild as reEnrollChildService,
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
  // Billing sync service
  syncFamilyBillingRate as syncFamilyBillingRateService,
  type SyncFamilyBillingResult,
} from '@/lib/services/dugsi'
import { getTeachersByProgram as getTeachersByProgramService } from '@/lib/services/shared/teacher-service'
import { sendPaymentLink } from '@/lib/services/whatsapp/whatsapp-service'
import { getDugsiStripeClient } from '@/lib/stripe-dugsi'
import {
  normalizeEmail,
  normalizePhone,
} from '@/lib/utils/contact-normalization'
import { formatFullName } from '@/lib/utils/formatters'
import {
  FamilyBillingControlSchema,
  ReEnrollChildSchema,
  UpdateFamilyShiftSchema,
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
  ClassWithDetails,
  StudentForEnrollment,
  StripePaymentHistoryItem,
  UnassignedStudent,
} from './_types'
import {
  isActiveDugsiRegistration,
  isChurnedDugsiRegistration,
} from './_utils/family'

const logger = createServiceLogger('dugsi-admin-actions')

// module-private
const fillVCardName = (
  target: VCardContact,
  firstName: string | null,
  lastName: string | null,
  fullName: string
) => {
  if (!target.firstName && firstName) {
    target.firstName = firstName
    target.lastName = lastName ?? ''
    target.fullName = fullName
  }
}

// ============================================================================
// Schemas for actions that take positional string args
// ============================================================================

const StudentIdSchema = z.object({ studentId: z.string().min(1) })
const SubscriptionIdSchema = z.object({ subscriptionId: z.string().min(1) })
const ParentEmailSchema = z.object({ parentEmail: z.string().email() })
const ClassIdSchema = z.object({ classId: z.string().min(1) })
const ShiftFilterSchema = z.object({
  shift: z.nativeEnum(Shift).optional(),
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
  .schema(ShiftFilterSchema)
  .action(async ({ parsedInput }): Promise<DugsiRegistration[]> => {
    return await getAllDugsiRegistrations(undefined, parsedInput)
  })

const _generateDugsiVCardContent = adminActionClient
  .metadata({ actionName: 'generateDugsiVCardContent' })
  .schema(
    z.object({
      shift: z.nativeEnum(Shift).optional(),
      includeChurned: z.boolean().default(false),
    })
  )
  .action(
    async ({
      parsedInput: { shift, includeChurned },
    }): Promise<VCardResult> => {
      const registrations = await getAllDugsiRegistrations(
        undefined,
        shift ? { shift } : undefined
      )

      const familyMap = new Map<string, DugsiRegistration[]>()
      for (const reg of registrations) {
        const key =
          reg.familyReferenceId ||
          normalizeEmail(reg.parentEmail) ||
          normalizePhone(reg.parentPhone) ||
          reg.id
        const list = familyMap.get(key) ?? []
        list.push(reg)
        familyMap.set(key, list)
      }

      const organization = shift ? `Dugsi - ${shift}` : 'Irshad Dugsi'
      const filename = shift
        ? `dugsi-${shift.toLowerCase()}-parent-contacts-${getDateString()}.vcf`
        : `dugsi-parent-contacts-${getDateString()}.vcf`

      // contactMap and childNamesByKey are always maintained with identical key sets.
      // Every add/delete must touch both; see mergeSecondary for the delete path.
      const contactMap = new Map<string, VCardContact>()
      const childNamesByKey = new Map<string, Set<string>>()
      const phoneToKey = new Map<string, string>()
      const emailToKey = new Map<string, string>()
      let skippedNoContact = 0
      let skippedDuplicate = 0
      let skippedChurned = 0

      for (const members of familyMap.values()) {
        const hasSubscription = members.some(isActiveDugsiRegistration)
        const hasChurned = members.some(isChurnedDugsiRegistration)
        const hasRecoverable = members.some(
          (m) =>
            !!m.stripeSubscriptionIdDugsi &&
            (m.subscriptionStatus === SubscriptionStatus.past_due ||
              m.subscriptionStatus === SubscriptionStatus.unpaid)
        )
        if (
          !includeChurned &&
          hasChurned &&
          !hasSubscription &&
          !hasRecoverable
        ) {
          skippedChurned++
          continue
        }

        const first = members[0]
        if (!first) continue
        const memberNames = members.map((m) => m.name)

        const addParent = (
          firstName: string | null,
          lastName: string | null,
          email: string | null,
          phone: string | null,
          isIntraFamilyDuplicate: boolean
        ) => {
          const formattedPhone = formatPhoneForVCard(phone)
          const normalizedEmail = normalizeEmail(email)
          if (!formattedPhone && !normalizedEmail) {
            skippedNoContact++
            return
          }

          const dedupeKey = normalizedEmail || formattedPhone || ''
          // Step 1: fast path — dedupeKey is still the live contactMap key.
          // Step 2: phone bridge — dedupeKey differs but same phone seen before.
          // Step 3: email bridge — email was a live key that mergeSecondary deleted
          //   from contactMap (bridge merge); emailToKey still points to the survivor.
          //   Removing step 3 breaks A→C→B arrival order: after C's key is deleted,
          //   a later email-only record falls through steps 1 & 2 and creates a duplicate.
          const resolvedKey = contactMap.has(dedupeKey)
            ? dedupeKey
            : formattedPhone && phoneToKey.has(formattedPhone)
              ? phoneToKey.get(formattedPhone)!
              : normalizedEmail && emailToKey.has(normalizedEmail)
                ? emailToKey.get(normalizedEmail)!
                : dedupeKey

          if (contactMap.has(resolvedKey)) {
            skippedDuplicate++
            if (!isIntraFamilyDuplicate) {
              const childSet = childNamesByKey.get(resolvedKey)!
              memberNames.forEach((n) => childSet.add(n))
            }

            // Bridge detection: if the current record carries both identifiers
            // and one of them already points to a separate contact (e.g. A→C→B
            // ordering where B bridges phone-only A and email-only C), merge
            // the secondary contact into resolvedKey retroactively.
            const mergeSecondary = (secondaryKey: string) => {
              if (secondaryKey === resolvedKey || !contactMap.has(secondaryKey))
                return
              skippedDuplicate++
              childNamesByKey
                .get(secondaryKey)!
                .forEach((n) => childNamesByKey.get(resolvedKey)!.add(n))
              const primary = contactMap.get(resolvedKey)!
              const secondary = contactMap.get(secondaryKey)!
              if (!primary.phone && secondary.phone)
                primary.phone = secondary.phone
              if (!primary.email && secondary.email)
                primary.email = secondary.email
              fillVCardName(
                primary,
                secondary.firstName,
                secondary.lastName,
                secondary.fullName
              )
              for (const [k, v] of phoneToKey)
                if (v === secondaryKey) phoneToKey.set(k, resolvedKey)
              for (const [k, v] of emailToKey)
                if (v === secondaryKey) emailToKey.set(k, resolvedKey)
              contactMap.delete(secondaryKey)
              childNamesByKey.delete(secondaryKey)
            }

            if (formattedPhone) {
              const phoneKey = phoneToKey.get(formattedPhone)
              if (phoneKey !== undefined) mergeSecondary(phoneKey)
            }
            if (normalizedEmail) {
              const emailKey = emailToKey.get(normalizedEmail)
              if (emailKey !== undefined) mergeSecondary(emailKey)
            }

            const primaryContact = contactMap.get(resolvedKey)!
            if (formattedPhone && !primaryContact.phone)
              primaryContact.phone = formattedPhone
            if (normalizedEmail && !primaryContact.email)
              primaryContact.email = normalizedEmail
            fillVCardName(
              primaryContact,
              firstName,
              lastName,
              formatFullName(firstName, lastName)
            )

            if (formattedPhone) phoneToKey.set(formattedPhone, resolvedKey)
            if (normalizedEmail) emailToKey.set(normalizedEmail, resolvedKey)
            return
          }

          childNamesByKey.set(dedupeKey, new Set(memberNames))
          contactMap.set(dedupeKey, {
            firstName: firstName || '',
            lastName: lastName || '',
            fullName: formatFullName(firstName, lastName, 'Dugsi Parent'),
            phone: formattedPhone,
            email: normalizedEmail || undefined,
            organization,
          })
          if (formattedPhone) phoneToKey.set(formattedPhone, dedupeKey)
          if (normalizedEmail) emailToKey.set(normalizedEmail, dedupeKey)
        }

        addParent(
          first.parentFirstName,
          first.parentLastName,
          first.parentEmail,
          first.parentPhone,
          false
        )

        if (first.parent2Phone || first.parent2Email) {
          const p1Phone = formatPhoneForVCard(first.parentPhone) || ''
          const p2Phone = formatPhoneForVCard(first.parent2Phone) || ''
          const parent1Email = normalizeEmail(first.parentEmail)
          const parent2Email = normalizeEmail(first.parent2Email)
          const phoneOverlap = p1Phone !== '' && p1Phone === p2Phone
          const emailOverlap =
            parent1Email !== null && parent1Email === parent2Email
          const isIntraFamilyDuplicate = phoneOverlap || emailOverlap
          addParent(
            first.parent2FirstName,
            first.parent2LastName,
            first.parent2Email,
            first.parent2Phone,
            isIntraFamilyDuplicate
          )
        } else if (first.parent2FirstName || first.parent2LastName) {
          skippedNoContact++
        }
      }

      for (const [key, contact] of contactMap.entries()) {
        const children = childNamesByKey.get(key)!
        contact.note = `Children: ${[...children].join(', ')}`
      }

      const contacts = Array.from(contactMap.values())

      logger.info(
        {
          exported: contacts.length,
          skippedNoContact,
          skippedDuplicate,
          skippedChurned,
          totalFamilies: familyMap.size, // vCard grouping: phone-normalized, may differ from UI family count
          includeChurned,
          shift,
        },
        'Dugsi contacts exported'
      )

      return {
        content: generateVCardsContent(contacts),
        filename,
        exported: contacts.length,
        skippedNoContact,
        skippedDuplicate,
        skippedChurned,
      }
    }
  )

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
  .schema(StudentIdSchema)
  .action(async ({ parsedInput }): Promise<DugsiRegistration[]> => {
    return await getFamilyMembersService(parsedInput.studentId)
  })

const _getDeleteFamilyPreview = adminActionClient
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

const _validateDugsiSubscription = adminActionClient
  .metadata({ actionName: 'validateDugsiSubscription' })
  .schema(SubscriptionIdSchema)
  .action(async ({ parsedInput }): Promise<SubscriptionValidationData> => {
    return await validateDugsiSubscriptionService(parsedInput.subscriptionId)
  })

const _getDugsiPaymentStatus = adminActionClient
  .metadata({ actionName: 'getDugsiPaymentStatus' })
  .schema(ParentEmailSchema)
  .action(async ({ parsedInput }): Promise<PaymentStatusData> => {
    return await getPaymentStatus(parsedInput.parentEmail)
  })

const _getFamilyPaymentHistory = adminActionClient
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

const _getAvailableStudentsForClassAction = adminActionClient
  .metadata({ actionName: 'getAvailableStudentsForClassAction' })
  .schema(z.object({ shift: z.nativeEnum(Shift) }))
  .action(async ({ parsedInput }): Promise<StudentForEnrollment[]> => {
    return await getAvailableStudentsForClass(parsedInput.shift)
  })

const _getClassDeletePreviewAction = adminActionClient
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

const _deleteDugsiFamily = adminActionClient
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
      after(() => {
        revalidatePath('/admin/dugsi')
        revalidateTag('dugsi-registrations')
      })

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
      after(() => {
        revalidatePath('/admin/dugsi')
        revalidateTag('dugsi-registrations')
      })

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
      after(() => {
        revalidatePath('/admin/dugsi')
        revalidateTag('dugsi-registrations')
      })
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
  .schema(UpdateParentInfoSchema)
  .action(
    async ({ parsedInput }): Promise<{ updated: number; message: string }> => {
      const result = await updateParentInfoService(parsedInput)
      after(() => {
        revalidatePath('/admin/dugsi')
        revalidateTag('dugsi-registrations')
      })
      return {
        ...result,
        message: `Successfully updated parent information for ${result.updated} ${result.updated === 1 ? 'student' : 'students'}`,
      }
    }
  )

const _addSecondParent = adminActionClient
  .metadata({ actionName: 'addSecondParent' })
  .schema(AddSecondParentSchema)
  .action(
    async ({ parsedInput }): Promise<{ updated: number; message: string }> => {
      const result = await addSecondParentService(parsedInput)
      after(() => {
        revalidatePath('/admin/dugsi')
        revalidateTag('dugsi-registrations')
      })
      return {
        ...result,
        message: `Successfully added second parent to ${result.updated} ${result.updated === 1 ? 'student' : 'students'}`,
      }
    }
  )

const _setPrimaryPayer = adminActionClient
  .metadata({ actionName: 'setPrimaryPayer' })
  .schema(SetPrimaryPayerSchema)
  .action(
    async ({ parsedInput }): Promise<{ updated: number; message: string }> => {
      const result = await setPrimaryPayerService(parsedInput)
      after(() => {
        revalidatePath('/admin/dugsi')
        revalidateTag('dugsi-registrations')
      })
      return {
        ...result,
        message: `Parent ${parsedInput.parentNumber} is now the primary payer`,
      }
    }
  )

const _updateChildInfo = adminActionClient
  .metadata({ actionName: 'updateChildInfo' })
  .schema(UpdateChildInfoSchema)
  .action(async ({ parsedInput }): Promise<{ message: string }> => {
    await updateChildInfoService(parsedInput)
    after(() => {
      revalidatePath('/admin/dugsi')
      revalidateTag('dugsi-registrations')
    })
    return { message: 'Successfully updated child information' }
  })

const _updateFamilyShift = adminActionClient
  .metadata({ actionName: 'updateFamilyShift' })
  .schema(UpdateFamilyShiftSchema)
  .action(async ({ parsedInput }): Promise<{ message: string }> => {
    await updateFamilyShiftService({
      familyReferenceId: parsedInput.familyReferenceId,
      shift: parsedInput.shift,
    })
    after(() => {
      revalidatePath('/admin/dugsi')
      revalidateTag('dugsi-registrations')
    })
    return { message: 'Successfully updated family shift' }
  })

const _addChildToFamily = adminActionClient
  .metadata({ actionName: 'addChildToFamily' })
  .schema(AddChildToFamilySchema)
  .action(
    async ({ parsedInput }): Promise<{ childId: string; message: string }> => {
      const result = await addChildToFamilyService(parsedInput)
      after(() => {
        revalidatePath('/admin/dugsi')
        revalidateTag('dugsi-registrations')
      })
      return { ...result, message: 'Successfully added child to family' }
    }
  )

const _reEnrollChild = rateLimitedAdminActionClient
  .metadata({ actionName: 'reEnrollChild', maxAttempts: 10 })
  .schema(ReEnrollChildSchema)
  .action(async ({ parsedInput }) => {
    const result = await reEnrollChildService(parsedInput.profileId)
    after(() => {
      revalidatePath('/admin/dugsi')
      revalidateTag('dugsi-registrations')
    })
    return result
  })

const _recalculateFamilyRate = rateLimitedAdminActionClient
  .metadata({ actionName: 'recalculateFamilyRate', maxAttempts: 30 })
  .schema(FamilyBillingControlSchema)
  .action(async ({ parsedInput }): Promise<SyncFamilyBillingResult> => {
    const result = await syncFamilyBillingRateService(
      parsedInput.familyReferenceId
    )
    after(() => {
      revalidatePath('/admin/dugsi')
      revalidateTag('dugsi-registrations')
    })
    return result
  })

const _generateFamilyPaymentLinkAction = adminActionClient
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

const _bulkGeneratePaymentLinksAction = adminActionClient
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

    after(() => {
      revalidatePath('/admin/dugsi/classes')
      revalidatePath('/teacher/checkin')
    })
    logger.info({ classId, teacherId }, 'Teacher assigned to class')
    return { message: 'Teacher assigned to class' }
  })

const _removeTeacherFromClassAction = adminActionClient
  .metadata({ actionName: 'removeTeacherFromClassAction' })
  .schema(RemoveTeacherFromClassSchema)
  .action(async ({ parsedInput }): Promise<{ message: string }> => {
    const { classId, teacherId } = parsedInput
    await removeTeacherFromClass(classId, teacherId)
    after(() => {
      revalidatePath('/admin/dugsi/classes')
      revalidatePath('/teacher/checkin')
    })
    logger.info({ classId, teacherId }, 'Teacher removed from class')
    return { message: 'Teacher removed from class' }
  })

const _enrollStudentInClassAction = adminActionClient
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
    after(() => {
      revalidatePath('/admin/dugsi/classes')
    })
    logger.info({ classId, programProfileId }, 'Student enrolled in class')
    return { message: 'Student enrolled in class' }
  })

const _removeStudentFromClassAction = adminActionClient
  .metadata({ actionName: 'removeStudentFromClassAction' })
  .schema(RemoveStudentFromClassSchema)
  .action(async ({ parsedInput }): Promise<{ message: string }> => {
    const { programProfileId } = parsedInput
    await removeStudentFromClass(programProfileId)
    after(() => {
      revalidatePath('/admin/dugsi/classes')
    })
    logger.info({ programProfileId }, 'Student removed from class')
    return { message: 'Student removed from class' }
  })

const _bulkEnrollStudentsAction = adminActionClient
  .metadata({ actionName: 'bulkEnrollStudentsAction' })
  .schema(BulkEnrollStudentsSchema)
  .action(
    async ({
      parsedInput,
    }): Promise<{ enrolled: number; moved: number; message: string }> => {
      const { classId, programProfileIds } = parsedInput
      const result = await bulkEnrollStudents(classId, programProfileIds)
      after(() => {
        revalidatePath('/admin/dugsi/classes')
      })
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
  .schema(CreateClassSchema)
  .action(
    async ({
      parsedInput,
    }): Promise<ClassWithDetails & { message: string }> => {
      const { name, shift, description } = parsedInput
      try {
        const newClass = await createClass(name, shift as Shift, description)
        after(() => {
          revalidatePath('/admin/dugsi/classes')
          revalidatePath('/teacher/checkin')
        })
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

      after(() => {
        revalidatePath('/admin/dugsi/classes')
        revalidatePath('/teacher/checkin')
      })
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
    after(() => {
      revalidatePath('/admin/dugsi/classes')
      revalidatePath('/teacher/checkin')
    })
    logger.info({ classId }, 'Class deleted')
    return { message: 'Class deleted successfully' }
  })

// ============================================================================
// Consolidate Subscription Actions
// ============================================================================

const _previewStripeSubscriptionForConsolidation = adminActionClient
  .metadata({ actionName: 'previewStripeSubscriptionForConsolidation' })
  .schema(previewSubscriptionInputSchema)
  .action(async ({ parsedInput }): Promise<StripeSubscriptionPreview> => {
    return await previewStripeSubscriptionService(
      parsedInput.subscriptionId,
      parsedInput.familyId
    )
  })

const _consolidateDugsiSubscription = adminActionClient
  .metadata({ actionName: 'consolidateDugsiSubscription' })
  .schema(consolidateSubscriptionInputSchema)
  .action(
    async ({
      parsedInput,
    }): Promise<ConsolidateSubscriptionResult & { message: string }> => {
      const result = await consolidateStripeSubscriptionService(parsedInput)
      after(() => {
        revalidatePath('/admin/dugsi')
        revalidateTag('dugsi-registrations')
      })

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

      after(() => {
        revalidatePath('/admin/dugsi')
        revalidateTag('dugsi-registrations')
      })
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
export async function reEnrollChild(
  ...args: Parameters<typeof _reEnrollChild>
) {
  return _reEnrollChild(...args)
}
export async function recalculateFamilyRate(
  ...args: Parameters<typeof _recalculateFamilyRate>
) {
  return _recalculateFamilyRate(...args)
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
