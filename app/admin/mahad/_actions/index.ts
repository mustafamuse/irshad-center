'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { after } from 'next/server'

import {
  GraduationStatus,
  PaymentFrequency,
  StudentBillingType,
} from '@prisma/client'
import { z } from 'zod'

import { featureFlags } from '@/lib/config/feature-flags'
import {
  createBatch,
  deleteBatch,
  getBatchById,
  getBatchByName,
  updateBatch,
  assignStudentsToBatch,
  transferStudents,
} from '@/lib/db/queries/batch'
import {
  getStudentById,
  getProfileForPaymentLink,
  setProfileBillingDefaults,
  resolveDuplicateStudents,
  getStudentDeleteWarnings,
} from '@/lib/db/queries/student'
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { getMahadKeys } from '@/lib/keys/stripe'
import { createActionLogger, logError } from '@/lib/logger'
import { adminActionClient } from '@/lib/safe-action'
import {
  deleteStudentProfile,
  bulkDeleteStudentProfiles,
  updateStudentProfile,
} from '@/lib/services/mahad/student-mutation-service'
import { getMahadStripeClient } from '@/lib/stripe-mahad'
import { validateBillingCycleAnchor } from '@/lib/utils/billing-date'
import {
  normalizeEmail,
  normalizePhone,
} from '@/lib/utils/contact-normalization'
import {
  calculateMahadRate,
  getStripeInterval,
} from '@/lib/utils/mahad-tuition'
import { isPrismaError } from '@/lib/utils/type-guards'
import {
  CreateBatchSchema,
  UpdateBatchSchema,
  BatchAssignmentSchema,
  BatchTransferSchema,
  UpdateStudentSchema,
} from '@/lib/validations/batch'
import {
  BillingStartDateSchema,
  OverrideAmountSchema,
} from '@/lib/validations/billing'
import { MAX_EXPECTED_RATE_CENTS } from '@/lib/validations/checkout'

import type { BulkDeleteResult, DeleteWarnings } from '../_types'

const logger = createActionLogger('mahad')

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type AssignmentResult = {
  assignedCount: number
  failedAssignments: string[]
}
type TransferResult = {
  transferredCount: number
  failedTransfers: string[]
}

// ============================================================================
// BATCH ACTION SCHEMAS
// ============================================================================

const createBatchInputSchema = z.object({
  name: z
    .string()
    .min(1, 'Batch name is required')
    .max(100, 'Batch name must be less than 100 characters')
    .trim(),
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
})

const deleteBatchInputSchema = z.object({
  id: z.string().uuid('Invalid batch ID'),
})

const updateBatchInputSchema = z.object({
  id: z.string().uuid('Invalid batch ID'),
  name: z
    .string()
    .min(1, 'Batch name is required')
    .max(100, 'Batch name must be less than 100 characters')
    .trim()
    .optional(),
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
})

const updateStudentInputSchema = UpdateStudentSchema.extend({
  id: z.string().uuid('Invalid student ID'),
})

const resolveDuplicatesInputSchema = z.object({
  keepId: z.string().uuid('Invalid student ID'),
  deleteIds: z
    .array(z.string().uuid('Invalid duplicate ID'))
    .min(1, 'No duplicate records selected for deletion'),
  mergeData: z.boolean().optional().default(false),
})

const studentIdInputSchema = z.object({
  id: z.string().uuid('Invalid student ID'),
})

const bulkDeleteInputSchema = z.object({
  studentIds: z
    .array(z.string().uuid('Invalid student ID'))
    .min(1, 'No students selected for deletion'),
})

const paymentLinkInputSchema = z.object({
  profileId: z.string().uuid('Invalid student ID'),
})

const paymentLinkWithOverrideInputSchema = z.object({
  profileId: z.string().uuid('Invalid student ID'),
  overrideAmount: z.number().optional(),
  billingStartDate: z.string().optional(),
})

// ============================================================================
// BATCH ACTIONS
// ============================================================================

const _createBatchAction = adminActionClient
  .metadata({ actionName: 'createBatchAction' })
  .schema(createBatchInputSchema)
  .action(async ({ parsedInput }) => {
    const validated = CreateBatchSchema.parse({
      name: parsedInput.name,
      startDate: parsedInput.startDate ?? undefined,
      endDate: parsedInput.endDate ?? undefined,
    })

    const existing = await getBatchByName(validated.name)
    if (existing) {
      throw new ActionError(
        `A cohort with the name "${validated.name}" already exists`,
        ERROR_CODES.VALIDATION_ERROR
      )
    }

    let batch
    try {
      batch = await createBatch({
        name: validated.name,
        startDate: validated.startDate ?? null,
        endDate: validated.endDate ?? null,
      })
    } catch (error) {
      if (isPrismaError(error) && error.code === 'P2002') {
        throw new ActionError(
          `A cohort with the name "${validated.name}" already exists`,
          ERROR_CODES.VALIDATION_ERROR
        )
      }
      throw error
    }

    after(() => {
      revalidateTag('mahad-stats')
      revalidateTag('mahad-students')
      revalidatePath('/admin/mahad')
    })

    return batch
  })

export async function createBatchAction(
  ...args: Parameters<typeof _createBatchAction>
) {
  return _createBatchAction(...args)
}

const _deleteBatchAction = adminActionClient
  .metadata({ actionName: 'deleteBatchAction' })
  .schema(deleteBatchInputSchema)
  .action(async ({ parsedInput }) => {
    const batch = await getBatchById(parsedInput.id)
    if (!batch) {
      throw new ActionError('Cohort not found', ERROR_CODES.NOT_FOUND)
    }

    if (batch.studentCount > 0) {
      throw new ActionError(
        `Cannot delete cohort "${batch.name}": ${batch.studentCount} student${batch.studentCount > 1 ? 's' : ''} enrolled. Transfer them first.`,
        ERROR_CODES.VALIDATION_ERROR
      )
    }

    try {
      await deleteBatch(parsedInput.id)
    } catch (error) {
      if (isPrismaError(error)) {
        if (error.code === 'P2025')
          throw new ActionError('Cohort not found', ERROR_CODES.NOT_FOUND)
        if (error.code === 'P2003')
          throw new ActionError(
            'Cannot delete cohort with related records',
            ERROR_CODES.VALIDATION_ERROR
          )
      }
      throw error
    }

    after(() => {
      revalidateTag('mahad-stats')
      revalidateTag('mahad-students')
      revalidatePath('/admin/mahad')
    })
  })

export async function deleteBatchAction(
  ...args: Parameters<typeof _deleteBatchAction>
) {
  return _deleteBatchAction(...args)
}

const _updateBatchAction = adminActionClient
  .metadata({ actionName: 'updateBatchAction' })
  .schema(updateBatchInputSchema)
  .action(async ({ parsedInput }) => {
    const { id, ...data } = parsedInput
    const validated = UpdateBatchSchema.parse(data)

    const existingBatch = await getBatchById(id)
    if (!existingBatch) {
      throw new ActionError('Cohort not found', ERROR_CODES.NOT_FOUND)
    }

    if (validated.name !== undefined) {
      const conflict = await getBatchByName(validated.name)
      if (conflict && conflict.id !== id) {
        throw new ActionError(
          `A cohort with the name "${validated.name}" already exists`,
          ERROR_CODES.VALIDATION_ERROR
        )
      }
    }

    let batch
    try {
      batch = await updateBatch(id, {
        name: validated.name,
        startDate: validated.startDate,
        endDate: validated.endDate,
      })
    } catch (error) {
      if (isPrismaError(error) && error.code === 'P2002') {
        throw new ActionError(
          `A cohort with the name "${validated.name}" already exists`,
          ERROR_CODES.VALIDATION_ERROR
        )
      }
      if (isPrismaError(error) && error.code === 'P2025') {
        throw new ActionError('Cohort not found', ERROR_CODES.NOT_FOUND)
      }
      throw error
    }

    after(() => {
      revalidateTag('mahad-stats')
      revalidateTag('mahad-students')
      revalidatePath('/admin/mahad')
    })

    return batch
  })

export async function updateBatchAction(
  ...args: Parameters<typeof _updateBatchAction>
) {
  return _updateBatchAction(...args)
}

// ============================================================================
// ASSIGNMENT ACTIONS
// ============================================================================

const _assignStudentsAction = adminActionClient
  .metadata({ actionName: 'assignStudentsAction' })
  .schema(BatchAssignmentSchema)
  .action(async ({ parsedInput }) => {
    const batch = await getBatchById(parsedInput.batchId)
    if (!batch) {
      throw new ActionError('Cohort not found', ERROR_CODES.NOT_FOUND)
    }

    try {
      const result = await assignStudentsToBatch(
        parsedInput.batchId,
        parsedInput.studentIds
      )

      after(() => {
        revalidateTag('mahad-stats')
        revalidateTag('mahad-students')
        revalidatePath('/admin/mahad')
      })

      return {
        assignedCount: result.assignedCount,
        failedAssignments: result.failedAssignments,
      } satisfies AssignmentResult
    } catch (error) {
      if (isPrismaError(error)) {
        if (error.code === 'P2003')
          throw new ActionError(
            'Invalid cohort or student reference',
            ERROR_CODES.VALIDATION_ERROR
          )
        if (error.code === 'P2025')
          throw new ActionError(
            'Cohort or student not found',
            ERROR_CODES.NOT_FOUND
          )
      }
      throw error
    }
  })

export async function assignStudentsAction(
  ...args: Parameters<typeof _assignStudentsAction>
) {
  return _assignStudentsAction(...args)
}

const _transferStudentsAction = adminActionClient
  .metadata({ actionName: 'transferStudentsAction' })
  .schema(BatchTransferSchema)
  .action(async ({ parsedInput }) => {
    const [fromBatch, toBatch] = await Promise.all([
      getBatchById(parsedInput.fromBatchId),
      getBatchById(parsedInput.toBatchId),
    ])

    if (!fromBatch) {
      throw new ActionError('Source cohort not found', ERROR_CODES.NOT_FOUND)
    }

    if (!toBatch) {
      throw new ActionError(
        'Destination cohort not found',
        ERROR_CODES.NOT_FOUND
      )
    }

    if (parsedInput.fromBatchId === parsedInput.toBatchId) {
      throw new ActionError(
        `Cannot transfer within the same cohort (${fromBatch.name})`,
        ERROR_CODES.VALIDATION_ERROR
      )
    }

    try {
      const result = await transferStudents(
        parsedInput.fromBatchId,
        parsedInput.toBatchId,
        parsedInput.studentIds
      )

      if (result.transferredCount === 0) {
        throw new ActionError(
          result.errors[0] || 'No students were transferred',
          ERROR_CODES.VALIDATION_ERROR
        )
      }

      after(() => {
        revalidateTag('mahad-stats')
        revalidateTag('mahad-students')
        revalidatePath('/admin/mahad')
      })

      return {
        transferredCount: result.transferredCount,
        failedTransfers: result.failedTransfers,
      } satisfies TransferResult
    } catch (error) {
      if (error instanceof ActionError) throw error
      if (isPrismaError(error)) {
        if (error.code === 'P2003')
          throw new ActionError(
            'Invalid cohort or student reference',
            ERROR_CODES.VALIDATION_ERROR
          )
        if (error.code === 'P2025')
          throw new ActionError(
            'Cohort or student not found',
            ERROR_CODES.NOT_FOUND
          )
      }
      throw error
    }
  })

export async function transferStudentsAction(
  ...args: Parameters<typeof _transferStudentsAction>
) {
  return _transferStudentsAction(...args)
}

// ============================================================================
// DUPLICATE RESOLUTION ACTIONS
// ============================================================================

const _resolveDuplicatesAction = adminActionClient
  .metadata({ actionName: 'resolveDuplicatesAction' })
  .schema(resolveDuplicatesInputSchema)
  .action(async ({ parsedInput }) => {
    const { keepId, deleteIds, mergeData } = parsedInput

    if (deleteIds.includes(keepId)) {
      throw new ActionError(
        'Cannot delete the record you want to keep',
        ERROR_CODES.VALIDATION_ERROR
      )
    }

    const [keepRecord, ...deleteRecords] = await Promise.all([
      getStudentById(keepId),
      ...deleteIds.map((id) => getStudentById(id)),
    ])

    if (!keepRecord) {
      throw new ActionError(
        'Student record to keep not found',
        ERROR_CODES.NOT_FOUND
      )
    }

    const missingRecords = deleteIds.filter((_, index) => !deleteRecords[index])
    if (missingRecords.length > 0) {
      throw new ActionError(
        'Some duplicate records could not be found',
        ERROR_CODES.NOT_FOUND
      )
    }

    try {
      await resolveDuplicateStudents(keepId, deleteIds, mergeData)
    } catch (error) {
      if (isPrismaError(error)) {
        if (error.code === 'P2025')
          throw new ActionError(
            'One or more student records not found',
            ERROR_CODES.NOT_FOUND
          )
        if (error.code === 'P2003')
          throw new ActionError(
            'Cannot resolve duplicates due to related records',
            ERROR_CODES.VALIDATION_ERROR
          )
      }
      throw error
    }

    after(() => {
      revalidateTag('mahad-stats')
      revalidateTag('mahad-students')
      revalidatePath('/admin/mahad')
    })
  })

export async function resolveDuplicatesAction(
  ...args: Parameters<typeof _resolveDuplicatesAction>
) {
  return _resolveDuplicatesAction(...args)
}

// ============================================================================
// STUDENT DELETION ACTIONS
// ============================================================================

const _getStudentDeleteWarningsAction = adminActionClient
  .metadata({ actionName: 'getStudentDeleteWarningsAction' })
  .schema(studentIdInputSchema)
  .action(async ({ parsedInput }): Promise<DeleteWarnings> => {
    const warnings = await getStudentDeleteWarnings(parsedInput.id)
    return warnings
  })

export async function getStudentDeleteWarningsAction(
  ...args: Parameters<typeof _getStudentDeleteWarningsAction>
) {
  return _getStudentDeleteWarningsAction(...args)
}

const _deleteStudentAction = adminActionClient
  .metadata({ actionName: 'deleteStudentAction' })
  .schema(studentIdInputSchema)
  .action(async ({ parsedInput }) => {
    const student = await getStudentById(parsedInput.id)
    if (!student) {
      throw new ActionError('Student not found', ERROR_CODES.NOT_FOUND)
    }

    // Best-effort guard under READ COMMITTED — not serializable, but
    // sufficient for admin-only tooling where concurrent subscription
    // creation targeting the same profile is operationally negligible.
    await deleteStudentProfile(parsedInput.id)

    after(() => {
      revalidateTag('mahad-stats')
      revalidateTag('mahad-students')
      revalidatePath('/admin/mahad')
    })
  })

export async function deleteStudentAction(
  ...args: Parameters<typeof _deleteStudentAction>
) {
  return _deleteStudentAction(...args)
}

const _bulkDeleteStudentsAction = adminActionClient
  .metadata({ actionName: 'bulkDeleteStudentsAction' })
  .schema(bulkDeleteInputSchema)
  .action(async ({ parsedInput }): Promise<BulkDeleteResult> => {
    const { studentIds } = parsedInput

    const { deletedCount, blockedIds } =
      await bulkDeleteStudentProfiles(studentIds)

    if (deletedCount > 0) {
      after(() => {
        revalidateTag('mahad-stats')
        revalidateTag('mahad-students')
        revalidatePath('/admin/mahad')
      })
    }

    return { deletedCount, blockedIds }
  })

export async function bulkDeleteStudentsAction(
  ...args: Parameters<typeof _bulkDeleteStudentsAction>
) {
  return _bulkDeleteStudentsAction(...args)
}

const _updateStudentAction = adminActionClient
  .metadata({ actionName: 'updateStudentAction' })
  .schema(updateStudentInputSchema)
  .action(async ({ parsedInput }) => {
    const { id, ...data } = parsedInput
    const validated = UpdateStudentSchema.parse(data)

    const currentStudent = await getStudentById(id)
    if (!currentStudent) {
      throw new ActionError('Student not found', ERROR_CODES.NOT_FOUND)
    }

    const normalizedPhone = validated.phone
      ? normalizePhone(validated.phone)
      : undefined
    if (
      validated.phone !== undefined &&
      validated.phone !== '' &&
      !normalizedPhone
    ) {
      throw new ActionError(
        'Invalid phone number. Expected a 10-digit US number (e.g. 612-555-1234)',
        ERROR_CODES.VALIDATION_ERROR,
        'phone',
        400
      )
    }

    await updateStudentProfile(id, {
      name: validated.name,
      dateOfBirth:
        validated.dateOfBirth !== undefined
          ? validated.dateOfBirth || null
          : undefined,
      email:
        validated.email !== undefined
          ? normalizeEmail(validated.email)
          : undefined,
      phone:
        validated.phone !== undefined ? normalizedPhone || null : undefined,
      gradeLevel:
        validated.gradeLevel !== undefined
          ? validated.gradeLevel || null
          : undefined,
      schoolName:
        validated.schoolName !== undefined
          ? validated.schoolName || null
          : undefined,
      graduationStatus:
        validated.graduationStatus !== undefined
          ? validated.graduationStatus || null
          : undefined,
      paymentFrequency:
        validated.paymentFrequency !== undefined
          ? validated.paymentFrequency || null
          : undefined,
      billingType:
        validated.billingType !== undefined
          ? validated.billingType || null
          : undefined,
      paymentNotes:
        validated.paymentNotes !== undefined
          ? validated.paymentNotes || null
          : undefined,
      batchId:
        validated.batchId !== undefined ? validated.batchId || null : undefined,
    })

    after(() => {
      revalidateTag('mahad-stats')
      revalidateTag('mahad-students')
      revalidatePath('/admin/mahad')
    })
  })

export async function updateStudentAction(
  ...args: Parameters<typeof _updateStudentAction>
) {
  return _updateStudentAction(...args)
}

// ============================================================================
// PAYMENT LINK GENERATION
// ============================================================================

export interface PaymentLinkData {
  url: string
  amount: number
  billingPeriod: string
}

const DEFAULT_BILLING_CONFIG: {
  graduationStatus: GraduationStatus
  billingType: StudentBillingType
  paymentFrequency: PaymentFrequency
} = {
  graduationStatus: 'NON_GRADUATE',
  billingType: 'FULL_TIME',
  paymentFrequency: 'MONTHLY',
}

async function createPaymentLinkSession(
  profileId: string
): Promise<PaymentLinkData> {
  // 1. Fetch profile with billing config and contact info
  const profile = await getProfileForPaymentLink(profileId)

  if (!profile) {
    throw new ActionError('Student profile not found', ERROR_CODES.NOT_FOUND)
  }

  // 2. Validate billing config is complete
  if (
    !profile.graduationStatus ||
    !profile.paymentFrequency ||
    !profile.billingType
  ) {
    throw new ActionError(
      'Billing configuration incomplete. Please set Graduation Status, Payment Frequency, and Billing Type first, then save changes.',
      ERROR_CODES.VALIDATION_ERROR
    )
  }

  // 3. Check if EXEMPT
  if (profile.billingType === 'EXEMPT') {
    throw new ActionError(
      'Exempt students do not need payment setup.',
      ERROR_CODES.VALIDATION_ERROR
    )
  }

  // 4. Calculate rate
  const amount = calculateMahadRate(
    profile.graduationStatus,
    profile.paymentFrequency,
    profile.billingType
  )

  if (amount <= 0) {
    throw new ActionError(
      'Invalid rate calculation. Please verify billing configuration.',
      ERROR_CODES.VALIDATION_ERROR
    )
  }

  // 5. Validate email exists
  const email = profile.person.email
  if (!email) {
    throw new ActionError(
      'Student email address is required for payment setup. Please add an email first.',
      ERROR_CODES.VALIDATION_ERROR
    )
  }

  // 6. Rate bounds validation - warn on unusually high rates
  if (amount > MAX_EXPECTED_RATE_CENTS) {
    logger.warn(
      { amount, maxExpected: MAX_EXPECTED_RATE_CENTS, profileId },
      'Unusually high rate calculated for admin payment link'
    )
  }

  // 7. Validate app URL configuration
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    throw new ActionError(
      'App URL not configured. Please set NEXT_PUBLIC_APP_URL.',
      ERROR_CODES.SERVER_ERROR
    )
  }

  // 8. Get validated product ID from centralized keys
  const { productId } = getMahadKeys()
  if (!productId) {
    throw new ActionError(
      'Stripe product not configured. Please set STRIPE_MAHAD_PRODUCT_ID.',
      ERROR_CODES.SERVER_ERROR
    )
  }

  // 9. Create Stripe checkout session
  const stripe = getMahadStripeClient()
  const intervalConfig = getStripeInterval(profile.paymentFrequency)

  let session: Awaited<ReturnType<typeof stripe.checkout.sessions.create>>
  try {
    session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      // Feature flag: Toggle card payments to manage transaction fees
      // ACH only: Lower fees for the organization
      // Card + ACH: More convenience for families
      payment_method_types: featureFlags.mahadCardPayments()
        ? ['card', 'us_bank_account']
        : ['us_bank_account'],
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product: productId,
            unit_amount: amount,
            recurring: intervalConfig,
          },
          quantity: 1,
        },
      ],
      subscription_data: {
        metadata: {
          profileId: profile.id,
          personId: profile.personId,
          studentName: profile.person.name,
          graduationStatus: profile.graduationStatus,
          paymentFrequency: profile.paymentFrequency,
          billingType: profile.billingType,
          calculatedRate: amount.toString(),
          source: 'admin-generated-link',
        },
      },
      metadata: {
        profileId: profile.id,
        personId: profile.personId,
        studentName: profile.person.name,
        source: 'admin-generated-link',
      },
      success_url: `${appUrl}/mahad/payment-complete?payment=success`,
      cancel_url: `${appUrl}/mahad/payment-complete?payment=canceled`,
      allow_promotion_codes: true,
    })
  } catch (error) {
    await logError(logger, error, 'Stripe checkout session creation failed', {
      profileId,
      amount,
    })
    throw new ActionError(
      'Failed to create payment session. Please try again.',
      ERROR_CODES.SERVER_ERROR
    )
  }

  const billingPeriod =
    profile.paymentFrequency === 'BI_MONTHLY' ? '/2 months' : '/month'

  if (!session.url) {
    throw new ActionError(
      'Failed to generate checkout URL. Please try again.',
      ERROR_CODES.SERVER_ERROR
    )
  }

  return {
    url: session.url,
    amount,
    billingPeriod,
  }
}

/**
 * Generate Stripe checkout link for students who abandoned checkout,
 * need a new link, or have been configured with billing settings by admin.
 */
const _generatePaymentLinkAction = adminActionClient
  .metadata({ actionName: 'generatePaymentLinkAction' })
  .schema(paymentLinkInputSchema)
  .action(async ({ parsedInput }): Promise<PaymentLinkData> => {
    return createPaymentLinkSession(parsedInput.profileId)
  })

export async function generatePaymentLinkAction(
  ...args: Parameters<typeof _generatePaymentLinkAction>
) {
  return _generatePaymentLinkAction(...args)
}

const _generatePaymentLinkWithDefaultsAction = adminActionClient
  .metadata({ actionName: 'generatePaymentLinkWithDefaultsAction' })
  .schema(paymentLinkInputSchema)
  .action(async ({ parsedInput }): Promise<PaymentLinkData> => {
    const { profileId } = parsedInput

    // Set defaults atomically; returns null if profile not found
    const updated = await setProfileBillingDefaults(
      profileId,
      DEFAULT_BILLING_CONFIG
    )
    if (!updated) {
      throw new ActionError('Student profile not found', ERROR_CODES.NOT_FOUND)
    }

    after(() => {
      revalidateTag('mahad-stats')
      revalidateTag('mahad-students')
      revalidatePath('/admin/mahad')
    })

    // Generate payment link (outside transaction since it's an external API call)
    return createPaymentLinkSession(profileId)
  })

export async function generatePaymentLinkWithDefaultsAction(
  ...args: Parameters<typeof _generatePaymentLinkWithDefaultsAction>
) {
  return _generatePaymentLinkWithDefaultsAction(...args)
}

// ============================================================================
// PAYMENT LINK WITH OVERRIDE
// ============================================================================

export interface GeneratePaymentLinkInput {
  profileId: string
  overrideAmount?: number // in cents
  billingStartDate?: string // ISO date string for delayed start
}

export interface PaymentLinkWithOverrideData {
  url: string
  calculatedAmount: number
  finalAmount: number
  isOverride: boolean
  billingPeriod: string
  billingConfig: {
    graduationStatus: GraduationStatus | null
    paymentFrequency: PaymentFrequency | null
    billingType: StudentBillingType | null
  }
  studentName: string
  studentPhone: string | null
}

/**
 * No revalidatePath() needed -- only creates a Stripe checkout session.
 * Subscription/billing updates happen via webhook after payment completion.
 */
const _generatePaymentLinkWithOverrideAction = adminActionClient
  .metadata({ actionName: 'generatePaymentLinkWithOverrideAction' })
  .schema(paymentLinkWithOverrideInputSchema)
  .action(async ({ parsedInput }): Promise<PaymentLinkWithOverrideData> => {
    const { profileId, overrideAmount, billingStartDate } = parsedInput

    // Validate billingStartDate if provided (Zod validation per CLAUDE.md Rule 8)
    if (billingStartDate) {
      const dateResult = BillingStartDateSchema.safeParse(billingStartDate)
      if (!dateResult.success) {
        throw new ActionError(
          dateResult.error.errors[0]?.message || 'Invalid billing start date',
          ERROR_CODES.VALIDATION_ERROR
        )
      }
    }

    // Validate override amount if provided
    if (overrideAmount !== undefined) {
      const amountResult = OverrideAmountSchema.safeParse(overrideAmount)
      if (!amountResult.success) {
        throw new ActionError(
          amountResult.error.errors[0]?.message || 'Invalid override amount',
          ERROR_CODES.VALIDATION_ERROR
        )
      }
    }

    // 1. Fetch profile with billing config and contact info
    const profile = await getProfileForPaymentLink(profileId)

    if (!profile) {
      throw new ActionError('Student profile not found', ERROR_CODES.NOT_FOUND)
    }

    // 2. Validate billing config is complete
    if (
      !profile.graduationStatus ||
      !profile.paymentFrequency ||
      !profile.billingType
    ) {
      throw new ActionError(
        'Billing configuration incomplete. Please set Graduation Status, Payment Frequency, and Billing Type first.',
        ERROR_CODES.VALIDATION_ERROR
      )
    }

    // 3. Check if EXEMPT
    if (profile.billingType === 'EXEMPT') {
      throw new ActionError(
        'Exempt students do not need payment setup.',
        ERROR_CODES.VALIDATION_ERROR
      )
    }

    // 4. Calculate rate
    const calculatedAmount = calculateMahadRate(
      profile.graduationStatus,
      profile.paymentFrequency,
      profile.billingType
    )

    if (calculatedAmount <= 0) {
      throw new ActionError(
        'Invalid rate calculation. Please verify billing configuration.',
        ERROR_CODES.VALIDATION_ERROR
      )
    }

    // 5. Determine final amount (override or calculated)
    const isOverride = overrideAmount !== undefined && overrideAmount > 0
    const finalAmount = isOverride ? overrideAmount : calculatedAmount

    // 6. Validate override amount if provided
    if (isOverride) {
      if (finalAmount <= 0) {
        throw new ActionError(
          'Override amount must be greater than 0',
          ERROR_CODES.VALIDATION_ERROR
        )
      }
      if (finalAmount > MAX_EXPECTED_RATE_CENTS * 2) {
        logger.warn(
          { finalAmount, profileId },
          'Override amount exceeds 2x max expected rate'
        )
      }
    }

    // 7. Validate email exists
    const email = profile.person.email
    const phone = profile.person.phone

    if (!email) {
      throw new ActionError(
        'Student email address is required for payment setup. Please add an email first.',
        ERROR_CODES.VALIDATION_ERROR
      )
    }

    // 8. Validate app URL configuration
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    if (!appUrl) {
      throw new ActionError(
        'App URL not configured. Please set NEXT_PUBLIC_APP_URL.',
        ERROR_CODES.SERVER_ERROR
      )
    }

    // 9. Get validated product ID
    const { productId } = getMahadKeys()
    if (!productId) {
      throw new ActionError(
        'Stripe product not configured. Please set STRIPE_MAHAD_PRODUCT_ID.',
        ERROR_CODES.SERVER_ERROR
      )
    }

    // 10. Create Stripe checkout session
    const stripe = getMahadStripeClient()
    const intervalConfig = getStripeInterval(profile.paymentFrequency)

    // Calculate and validate billing_cycle_anchor if start date provided
    let billingCycleAnchor: number | undefined
    if (billingStartDate) {
      const startDate = new Date(billingStartDate)
      billingCycleAnchor = Math.floor(startDate.getTime() / 1000)
      try {
        validateBillingCycleAnchor(billingCycleAnchor)
      } catch (error) {
        await logError(logger, error, 'Invalid billing cycle anchor', {
          billingCycleAnchor,
          profileId,
        })
        throw new ActionError(
          error instanceof Error ? error.message : 'Invalid billing start date',
          ERROR_CODES.VALIDATION_ERROR
        )
      }
    }

    logger.info(
      {
        profileId,
        billingStartDate: billingStartDate || 'immediate',
        billingCycleAnchor: billingCycleAnchor
          ? new Date(billingCycleAnchor * 1000).toISOString()
          : 'none',
        finalAmount: finalAmount / 100,
        isOverride,
      },
      'Creating payment link with billing config'
    )

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      // Feature flag: Toggle card payments to manage transaction fees
      // ACH only: Lower fees for the organization
      // Card + ACH: More convenience for families
      payment_method_types: featureFlags.mahadCardPayments()
        ? ['card', 'us_bank_account']
        : ['us_bank_account'],
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product: productId,
            unit_amount: finalAmount,
            recurring: intervalConfig,
          },
          quantity: 1,
        },
      ],
      subscription_data: {
        ...(billingCycleAnchor && {
          billing_cycle_anchor: billingCycleAnchor,
          proration_behavior: 'none' as const,
        }),
        metadata: {
          profileId: profile.id,
          personId: profile.personId,
          studentName: profile.person.name,
          graduationStatus: profile.graduationStatus,
          paymentFrequency: profile.paymentFrequency,
          billingType: profile.billingType,
          calculatedRate: calculatedAmount.toString(),
          finalRate: finalAmount.toString(),
          isOverride: isOverride.toString(),
          billingStartDate: billingStartDate || 'immediate',
          source: 'admin-generated-link',
        },
      },
      metadata: {
        profileId: profile.id,
        personId: profile.personId,
        studentName: profile.person.name,
        source: 'admin-generated-link',
      },
      success_url: `${appUrl}/mahad/payment-complete?payment=success`,
      cancel_url: `${appUrl}/mahad/payment-complete?payment=canceled`,
      allow_promotion_codes: true,
    })

    const billingPeriod =
      profile.paymentFrequency === 'BI_MONTHLY' ? '/2 months' : '/month'

    if (!session.url) {
      throw new ActionError(
        'Failed to generate checkout URL. Please try again.',
        ERROR_CODES.SERVER_ERROR
      )
    }

    return {
      url: session.url,
      calculatedAmount,
      finalAmount,
      isOverride,
      billingPeriod,
      billingConfig: {
        graduationStatus: profile.graduationStatus,
        paymentFrequency: profile.paymentFrequency,
        billingType: profile.billingType,
      },
      studentName: profile.person.name,
      studentPhone: phone,
    }
  })

export async function generatePaymentLinkWithOverrideAction(
  ...args: Parameters<typeof _generatePaymentLinkWithOverrideAction>
) {
  return _generatePaymentLinkWithOverrideAction(...args)
}
