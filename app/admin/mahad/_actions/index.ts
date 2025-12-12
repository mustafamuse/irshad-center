'use server'

/**
 * Batch Management Server Actions
 *
 * Server-side mutations for batch and student operations.
 * Only includes actively used actions - dead code removed.
 *
 * Uses Prisma-generated types and error codes for better type safety.
 */

import { revalidatePath } from 'next/cache'

import {
  Prisma,
  GraduationStatus,
  PaymentFrequency,
  StudentBillingType,
} from '@prisma/client'
import { z } from 'zod'

import { prisma } from '@/lib/db'
import {
  createBatch,
  deleteBatch,
  getBatchById,
  updateBatch,
  assignStudentsToBatch,
  transferStudents,
} from '@/lib/db/queries/batch'
import {
  getStudentById,
  resolveDuplicateStudents,
  getStudentDeleteWarnings,
} from '@/lib/db/queries/student'
import { getMahadKeys } from '@/lib/keys/stripe'
import { createActionLogger } from '@/lib/logger'
import { getMahadStripeClient } from '@/lib/stripe-mahad'
import { validateBillingCycleAnchor } from '@/lib/utils/billing-date'
import {
  calculateMahadRate,
  getStripeInterval,
} from '@/lib/utils/mahad-tuition'
import {
  CreateBatchSchema,
  UpdateBatchSchema,
  BatchAssignmentSchema,
  BatchTransferSchema,
  UpdateStudentSchema,
} from '@/lib/validations/batch'
import { MAX_EXPECTED_RATE_CENTS } from '@/lib/validations/checkout'

import type { UpdateStudentPayload } from '../_types/student-form'

const logger = createActionLogger('mahad')

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Action result type for consistent response structure
 */
type ActionResult<T = void> = {
  success: boolean
  data?: T
  error?: string
  errors?: Partial<Record<string, string[]>>
}

/**
 * Type aliases for cleaner function signatures
 */
type BatchData = Awaited<ReturnType<typeof createBatch>>
type AssignmentResult = {
  assignedCount: number
  failedAssignments: string[]
}
type TransferResult = {
  transferredCount: number
  failedTransfers: string[]
}

// ============================================================================
// PRISMA ERROR HANDLING
// ============================================================================

/**
 * Prisma error code constants
 */
const PRISMA_ERRORS = {
  UNIQUE_CONSTRAINT: 'P2002',
  RECORD_NOT_FOUND: 'P2025',
  FOREIGN_KEY_CONSTRAINT: 'P2003',
} as const

/**
 * Check if error is a Prisma error
 */
function isPrismaError(
  error: unknown
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  )
}

/**
 * Centralized error handler for all actions
 */
function handleActionError<T = void>(
  error: unknown,
  action: string,
  context?: { name?: string; handlers?: Record<string, string> }
): ActionResult<T> {
  // Handle Zod validation errors
  if (error instanceof z.ZodError) {
    return {
      success: false,
      errors: error.flatten().fieldErrors,
    }
  }

  // Log error with structured context
  logger.error({ err: error, action, context }, `Action failed: ${action}`)

  // Handle Prisma-specific errors with custom messages
  if (isPrismaError(error) && context?.handlers?.[error.code]) {
    return {
      success: false,
      error: context.handlers[error.code],
    }
  }

  // Default generic error message
  return {
    success: false,
    error: error instanceof Error ? error.message : `Failed to ${action}`,
  }
}

// ============================================================================
// BATCH ACTIONS
// ============================================================================

/**
 * Create a new batch
 */
export async function createBatchAction(
  formData: FormData
): Promise<ActionResult<BatchData>> {
  const rawData = {
    name: formData.get('name'),
    startDate: formData.get('startDate')
      ? new Date(formData.get('startDate') as string)
      : undefined,
    endDate: formData.get('endDate')
      ? new Date(formData.get('endDate') as string)
      : undefined,
  }

  try {
    const validated = CreateBatchSchema.parse(rawData)

    // Let Prisma handle uniqueness constraint - no race condition
    const batch = await createBatch({
      name: validated.name,
      startDate: validated.startDate ?? null,
      endDate: validated.endDate ?? null,
    })

    revalidatePath('/admin/mahad')

    return {
      success: true,
      data: batch,
    }
  } catch (error) {
    return handleActionError(error, 'createBatchAction', {
      handlers: {
        [PRISMA_ERRORS.UNIQUE_CONSTRAINT]: `A cohort with the name "${String(rawData.name)}" already exists`,
      },
    })
  }
}

/**
 * Delete a batch with safety checks
 */
export async function deleteBatchAction(id: string): Promise<ActionResult> {
  try {
    const batch = await getBatchById(id)
    if (!batch) {
      return {
        success: false,
        error: 'Cohort not found',
      }
    }

    // Use studentCount from existing batch query - no extra query needed
    if (batch.studentCount > 0) {
      return {
        success: false,
        error: `Cannot delete cohort "${batch.name}": ${batch.studentCount} student${batch.studentCount > 1 ? 's' : ''} enrolled. Transfer them first.`,
      }
    }

    await deleteBatch(id)
    revalidatePath('/admin/mahad')

    return {
      success: true,
    }
  } catch (error) {
    return handleActionError(error, 'deleteBatchAction', {
      handlers: {
        [PRISMA_ERRORS.RECORD_NOT_FOUND]: 'Cohort not found',
        [PRISMA_ERRORS.FOREIGN_KEY_CONSTRAINT]:
          'Cannot delete cohort with related records',
      },
    })
  }
}

/**
 * Update an existing batch
 */
export async function updateBatchAction(
  id: string,
  data: { name?: string; startDate?: Date | null; endDate?: Date | null }
): Promise<ActionResult<BatchData>> {
  try {
    const validated = UpdateBatchSchema.parse(data)

    const existingBatch = await getBatchById(id)
    if (!existingBatch) {
      return {
        success: false,
        error: 'Cohort not found',
      }
    }

    const batch = await updateBatch(id, {
      name: validated.name,
      startDate: validated.startDate,
      endDate: validated.endDate,
    })

    revalidatePath('/admin/mahad')

    return {
      success: true,
      data: batch,
    }
  } catch (error) {
    return handleActionError(error, 'updateBatchAction', {
      handlers: {
        [PRISMA_ERRORS.UNIQUE_CONSTRAINT]: `A cohort with the name "${String(data.name)}" already exists`,
        [PRISMA_ERRORS.RECORD_NOT_FOUND]: 'Cohort not found',
      },
    })
  }
}

// ============================================================================
// ASSIGNMENT ACTIONS
// ============================================================================

/**
 * Assign students to a batch
 */
export async function assignStudentsAction(
  batchId: string,
  studentIds: string[]
): Promise<ActionResult<AssignmentResult>> {
  try {
    const validated = BatchAssignmentSchema.parse({ batchId, studentIds })

    const batch = await getBatchById(validated.batchId)
    if (!batch) {
      return {
        success: false,
        error: 'Cohort not found',
      }
    }

    const result = await assignStudentsToBatch(
      validated.batchId,
      validated.studentIds
    )

    revalidatePath('/admin/mahad')

    return {
      success: true,
      data: {
        assignedCount: result.assignedCount,
        failedAssignments: result.failedAssignments,
      },
    }
  } catch (error) {
    return handleActionError(error, 'assignStudentsAction', {
      handlers: {
        [PRISMA_ERRORS.FOREIGN_KEY_CONSTRAINT]:
          'Invalid cohort or student reference',
        [PRISMA_ERRORS.RECORD_NOT_FOUND]: 'Cohort or student not found',
      },
    })
  }
}

/**
 * Transfer students between batches
 */
export async function transferStudentsAction(
  fromBatchId: string,
  toBatchId: string,
  studentIds: string[]
): Promise<ActionResult<TransferResult>> {
  try {
    const validated = BatchTransferSchema.parse({
      fromBatchId,
      toBatchId,
      studentIds,
    })

    const [fromBatch, toBatch] = await Promise.all([
      getBatchById(validated.fromBatchId),
      getBatchById(validated.toBatchId),
    ])

    if (!fromBatch) {
      return {
        success: false,
        error: 'Source cohort not found',
      }
    }

    if (!toBatch) {
      return {
        success: false,
        error: 'Destination cohort not found',
      }
    }

    if (validated.fromBatchId === validated.toBatchId) {
      return {
        success: false,
        error: `Cannot transfer within the same cohort (${fromBatch.name})`,
      }
    }

    const result = await transferStudents(
      validated.fromBatchId,
      validated.toBatchId,
      validated.studentIds
    )

    revalidatePath('/admin/mahad')

    return {
      success: true,
      data: {
        transferredCount: result.transferredCount,
        failedTransfers: result.failedTransfers,
      },
    }
  } catch (error) {
    return handleActionError(error, 'transferStudentsAction', {
      handlers: {
        [PRISMA_ERRORS.FOREIGN_KEY_CONSTRAINT]:
          'Invalid cohort or student reference',
        [PRISMA_ERRORS.RECORD_NOT_FOUND]: 'Cohort or student not found',
      },
    })
  }
}

// ============================================================================
// DUPLICATE RESOLUTION ACTIONS
// ============================================================================

/**
 * Resolve duplicate students
 */
export async function resolveDuplicatesAction(
  keepId: string,
  deleteIds: string[],
  mergeData: boolean = false
): Promise<ActionResult> {
  try {
    // Business logic validation only - Prisma handles UUID format
    if (!Array.isArray(deleteIds) || deleteIds.length === 0) {
      return {
        success: false,
        error: 'No duplicate records selected for deletion',
      }
    }

    if (deleteIds.includes(keepId)) {
      return {
        success: false,
        error: 'Cannot delete the record you want to keep',
      }
    }

    // Fetch all records in parallel - more efficient
    const [keepRecord, ...deleteRecords] = await Promise.all([
      getStudentById(keepId),
      ...deleteIds.map((id) => getStudentById(id)),
    ])

    if (!keepRecord) {
      return {
        success: false,
        error: 'Student record to keep not found',
      }
    }

    const missingRecords = deleteIds.filter(
      (id, index) => !deleteRecords[index]
    )
    if (missingRecords.length > 0) {
      return {
        success: false,
        error: `Some duplicate records not found: ${missingRecords.join(', ')}`,
      }
    }

    await resolveDuplicateStudents(keepId, deleteIds, mergeData)

    revalidatePath('/admin/mahad')

    return {
      success: true,
    }
  } catch (error) {
    return handleActionError(error, 'resolveDuplicatesAction', {
      handlers: {
        [PRISMA_ERRORS.RECORD_NOT_FOUND]:
          'One or more student records not found',
        [PRISMA_ERRORS.FOREIGN_KEY_CONSTRAINT]:
          'Cannot resolve duplicates due to related records',
      },
    })
  }
}

// ============================================================================
// STUDENT DELETION ACTIONS
// ============================================================================

/**
 * Get delete warnings for a student
 */
export async function getStudentDeleteWarningsAction(id: string) {
  try {
    const warnings = await getStudentDeleteWarnings(id)
    return { success: true, data: warnings } as const
  } catch (error) {
    logger.error(
      { err: error, studentId: id },
      'Failed to fetch delete warnings'
    )
    return {
      success: false,
      data: { hasSiblings: false, hasAttendanceRecords: false },
    } as const
  }
}

/**
 * Delete a single student
 */
export async function deleteStudentAction(id: string): Promise<ActionResult> {
  try {
    const student = await getStudentById(id)
    if (!student) {
      return {
        success: false,
        error: 'Student not found',
      }
    }

    await prisma.programProfile.delete({ where: { id } })

    revalidatePath('/admin/mahad')

    return {
      success: true,
    }
  } catch (error) {
    return handleActionError(error, 'deleteStudentAction', {
      handlers: {
        [PRISMA_ERRORS.RECORD_NOT_FOUND]: 'Student not found',
        [PRISMA_ERRORS.FOREIGN_KEY_CONSTRAINT]:
          'Cannot delete student with related records',
      },
    })
  }
}

/**
 * Bulk delete students
 */
export async function bulkDeleteStudentsAction(
  studentIds: string[]
): Promise<ActionResult<{ deletedCount: number; failedDeletes: string[] }>> {
  try {
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return { success: false, error: 'No students selected for deletion' }
    }

    let deletedCount = 0
    const failedDeletes: string[] = []
    const batchIdsToRevalidate = new Set<string>()

    for (const id of studentIds) {
      try {
        const student = await getStudentById(id)
        if (student?.batchId) {
          batchIdsToRevalidate.add(student.batchId)
        }
        await prisma.programProfile.delete({ where: { id } })
        deletedCount++
      } catch (error) {
        logger.error(
          { err: error, studentId: id },
          'Failed to delete student in bulk operation'
        )
        failedDeletes.push(id)
      }
    }

    revalidatePath('/admin/mahad')

    return {
      success: true,
      data: { deletedCount, failedDeletes },
    }
  } catch (error) {
    return handleActionError(error, 'bulkDeleteStudentsAction')
  }
}

/**
 * Update a student
 */
export async function updateStudentAction(
  id: string,
  data: UpdateStudentPayload
): Promise<ActionResult> {
  try {
    // Validate input data
    const validated = UpdateStudentSchema.parse(data)

    // Get current student to check if it exists
    const currentStudent = await getStudentById(id)
    if (!currentStudent) {
      return {
        success: false,
        error: 'Student not found',
      }
    }

    await prisma.$transaction(async (tx) => {
      const profile = await tx.programProfile.findUnique({
        where: { id },
        include: {
          person: { include: { contactPoints: true } },
          enrollments: { orderBy: { startDate: 'desc' }, take: 1 },
        },
      })

      if (!profile) throw new Error('Profile not found')

      if (validated.name !== undefined || validated.dateOfBirth !== undefined) {
        await tx.person.update({
          where: { id: profile.personId },
          data: {
            ...(validated.name !== undefined && { name: validated.name }),
            ...(validated.dateOfBirth !== undefined && {
              dateOfBirth: validated.dateOfBirth || null,
            }),
          },
        })
      }

      if (validated.email !== undefined) {
        const existingEmail = profile.person.contactPoints.find(
          (c) => c.type === 'EMAIL' && c.isActive
        )
        if (validated.email) {
          if (existingEmail) {
            await tx.contactPoint.update({
              where: { id: existingEmail.id },
              data: { value: validated.email.toLowerCase() },
            })
          } else {
            await tx.contactPoint.create({
              data: {
                personId: profile.personId,
                type: 'EMAIL',
                value: validated.email.toLowerCase(),
                isPrimary: true,
              },
            })
          }
        } else if (existingEmail) {
          await tx.contactPoint.update({
            where: { id: existingEmail.id },
            data: { isActive: false, deactivatedAt: new Date() },
          })
        }
      }

      if (validated.phone !== undefined) {
        const existingPhone = profile.person.contactPoints.find(
          (c) => c.type === 'PHONE' && c.isActive
        )
        if (validated.phone) {
          if (existingPhone) {
            await tx.contactPoint.update({
              where: { id: existingPhone.id },
              data: { value: validated.phone },
            })
          } else {
            await tx.contactPoint.create({
              data: {
                personId: profile.personId,
                type: 'PHONE',
                value: validated.phone,
                isPrimary: !profile.person.contactPoints.some(
                  (c) => c.isPrimary && c.isActive
                ),
              },
            })
          }
        } else if (existingPhone) {
          await tx.contactPoint.update({
            where: { id: existingPhone.id },
            data: { isActive: false, deactivatedAt: new Date() },
          })
        }
      }

      const profileFields = {
        ...(validated.gradeLevel !== undefined && {
          gradeLevel: validated.gradeLevel || null,
        }),
        ...(validated.schoolName !== undefined && {
          schoolName: validated.schoolName || null,
        }),
        ...(validated.graduationStatus !== undefined && {
          graduationStatus: validated.graduationStatus || null,
        }),
        ...(validated.paymentFrequency !== undefined && {
          paymentFrequency: validated.paymentFrequency || null,
        }),
        ...(validated.billingType !== undefined && {
          billingType: validated.billingType || null,
        }),
        ...(validated.paymentNotes !== undefined && {
          paymentNotes: validated.paymentNotes || null,
        }),
      }

      if (Object.keys(profileFields).length > 0) {
        await tx.programProfile.update({
          where: { id },
          data: profileFields,
        })
      }

      if (validated.batchId !== undefined) {
        const latestEnrollment = profile.enrollments[0]
        if (latestEnrollment) {
          await tx.enrollment.update({
            where: { id: latestEnrollment.id },
            data: { batchId: validated.batchId || null },
          })
        } else if (validated.batchId) {
          await tx.enrollment.create({
            data: {
              programProfileId: id,
              batchId: validated.batchId,
              status: 'REGISTERED',
              startDate: new Date(),
            },
          })
        }
      }
    })

    revalidatePath('/admin/mahad')

    return {
      success: true,
    }
  } catch (error) {
    return handleActionError(error, 'updateStudentAction', {
      handlers: {
        [PRISMA_ERRORS.RECORD_NOT_FOUND]: 'Student not found',
        [PRISMA_ERRORS.FOREIGN_KEY_CONSTRAINT]:
          'Invalid batch or related record reference',
      },
    })
  }
}

// ============================================================================
// PAYMENT LINK GENERATION
// ============================================================================

/**
 * Result type for payment link generation
 */
export type PaymentLinkResult = {
  success: boolean
  url?: string
  amount?: number
  billingPeriod?: string
  error?: string
}

/**
 * Generate a Stripe checkout payment link for a student
 *
 * This action allows admins to generate payment links for students who:
 * - Registered but abandoned checkout
 * - Need a new payment link (e.g., payment method update)
 * - Have been configured with specific billing settings by admin
 *
 * @param profileId - The student's program profile ID
 * @returns Payment link URL and calculated amount, or error
 */
export async function generatePaymentLinkAction(
  profileId: string
): Promise<PaymentLinkResult> {
  try {
    // 1. Fetch profile with billing config and contact info
    const profile = await prisma.programProfile.findUnique({
      where: { id: profileId },
      include: {
        person: {
          include: {
            contactPoints: {
              where: { type: 'EMAIL', isActive: true },
              orderBy: { isPrimary: 'desc' },
              take: 1,
            },
          },
        },
      },
    })

    if (!profile) {
      return { success: false, error: 'Student profile not found' }
    }

    // 2. Validate billing config is complete
    if (
      !profile.graduationStatus ||
      !profile.paymentFrequency ||
      !profile.billingType
    ) {
      return {
        success: false,
        error:
          'Billing configuration incomplete. Please set Graduation Status, Payment Frequency, and Billing Type first, then save changes.',
      }
    }

    // 3. Check if EXEMPT
    if (profile.billingType === 'EXEMPT') {
      return {
        success: false,
        error: 'Exempt students do not need payment setup.',
      }
    }

    // 4. Calculate rate
    const amount = calculateMahadRate(
      profile.graduationStatus,
      profile.paymentFrequency,
      profile.billingType
    )

    if (amount <= 0) {
      return {
        success: false,
        error: 'Invalid rate calculation. Please verify billing configuration.',
      }
    }

    // 5. Validate email exists
    const email = profile.person.contactPoints[0]?.value
    if (!email) {
      return {
        success: false,
        error:
          'Student email address is required for payment setup. Please add an email first.',
      }
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
      return {
        success: false,
        error: 'App URL not configured. Please set NEXT_PUBLIC_APP_URL.',
      }
    }

    // 8. Get validated product ID from centralized keys
    const { productId } = getMahadKeys()
    if (!productId) {
      return {
        success: false,
        error:
          'Stripe product not configured. Please set STRIPE_MAHAD_PRODUCT_ID.',
      }
    }

    // 9. Create Stripe checkout session
    const stripe = getMahadStripeClient()
    const intervalConfig = getStripeInterval(profile.paymentFrequency)

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      // Admin links support both card and ACH for flexibility (e.g., failed ACH retry).
      // User self-service checkout only allows ACH to enforce lower-fee payment method.
      payment_method_types: ['card', 'us_bank_account'],
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
      success_url: `${appUrl}/mahad/register?success=true`,
      cancel_url: `${appUrl}/mahad/register?canceled=true`,
      allow_promotion_codes: true,
    })

    const billingPeriod =
      profile.paymentFrequency === 'BI_MONTHLY' ? '/2 months' : '/month'

    // Validate session URL exists (it can be null for certain session types)
    if (!session.url) {
      return {
        success: false,
        error: 'Failed to generate checkout URL. Please try again.',
      }
    }

    return {
      success: true,
      url: session.url,
      amount,
      billingPeriod,
    }
  } catch (error) {
    logger.error({ err: error, profileId }, 'Error generating payment link')
    const message =
      error instanceof Error ? error.message : 'Failed to generate payment link'
    return { success: false, error: message }
  }
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

export async function generatePaymentLinkWithDefaultsAction(
  profileId: string
): Promise<PaymentLinkResult> {
  try {
    // Use transaction to ensure check + update are atomic
    const result = await prisma.$transaction(async (tx) => {
      // 1. Check student exists and get batch info via enrollment
      const profile = await tx.programProfile.findUnique({
        where: { id: profileId },
        include: {
          enrollments: {
            where: { status: { in: ['REGISTERED', 'ENROLLED'] } },
            select: { batchId: true },
            take: 1,
          },
        },
      })

      if (!profile) {
        return { success: false as const, error: 'Student profile not found' }
      }

      // 2. Update billing config with defaults
      await tx.programProfile.update({
        where: { id: profileId },
        data: {
          graduationStatus: DEFAULT_BILLING_CONFIG.graduationStatus,
          billingType: DEFAULT_BILLING_CONFIG.billingType,
          paymentFrequency: DEFAULT_BILLING_CONFIG.paymentFrequency,
        },
      })

      // Return batch ID for path revalidation
      return {
        success: true as const,
        batchId: profile.enrollments[0]?.batchId,
      }
    })

    if (!result.success) {
      return result
    }

    revalidatePath('/admin/mahad')

    // Generate payment link (outside transaction since it's an external API call)
    return generatePaymentLinkAction(profileId)
  } catch (error) {
    logger.error(
      { err: error, profileId },
      'Error generating payment link with default billing configuration'
    )

    if (isPrismaError(error) && error.code === PRISMA_ERRORS.RECORD_NOT_FOUND) {
      return { success: false, error: 'Student profile not found' }
    }

    const message =
      error instanceof Error ? error.message : 'Failed to generate payment link'

    return { success: false, error: message }
  }
}

// ============================================================================
// PAYMENT LINK WITH OVERRIDE
// ============================================================================

/**
 * Input for generating payment link with optional override
 */
export interface GeneratePaymentLinkInput {
  profileId: string
  overrideAmount?: number // in cents
  billingStartDate?: string // ISO date string for delayed start
}

/**
 * Extended result type for payment link with override info
 */
export interface PaymentLinkWithOverrideResult {
  success: boolean
  url?: string
  calculatedAmount?: number
  finalAmount?: number
  isOverride?: boolean
  billingPeriod?: string
  billingConfig?: {
    graduationStatus: GraduationStatus | null
    paymentFrequency: PaymentFrequency | null
    billingType: StudentBillingType | null
  }
  studentName?: string
  studentPhone?: string | null
  error?: string
}

/**
 * Generate a Stripe checkout payment link with optional override amount.
 *
 * This action allows admins to:
 * - Generate payment links with calculated rate based on billing config
 * - Override the rate with a custom amount
 * - Get billing config info for display in the UI
 *
 * @param input - Profile ID and optional override amount (in cents)
 * @returns Payment link URL, amounts, and billing info
 */
export async function generatePaymentLinkWithOverrideAction(
  input: GeneratePaymentLinkInput
): Promise<PaymentLinkWithOverrideResult> {
  const { profileId, overrideAmount, billingStartDate } = input

  try {
    // 1. Fetch profile with billing config and contact info
    const profile = await prisma.programProfile.findUnique({
      where: { id: profileId },
      include: {
        person: {
          include: {
            contactPoints: {
              where: { isActive: true },
              orderBy: { isPrimary: 'desc' },
            },
          },
        },
      },
    })

    if (!profile) {
      return { success: false, error: 'Student profile not found' }
    }

    // 2. Validate billing config is complete
    if (
      !profile.graduationStatus ||
      !profile.paymentFrequency ||
      !profile.billingType
    ) {
      return {
        success: false,
        error:
          'Billing configuration incomplete. Please set Graduation Status, Payment Frequency, and Billing Type first.',
        billingConfig: {
          graduationStatus: profile.graduationStatus,
          paymentFrequency: profile.paymentFrequency,
          billingType: profile.billingType,
        },
      }
    }

    // 3. Check if EXEMPT
    if (profile.billingType === 'EXEMPT') {
      return {
        success: false,
        error: 'Exempt students do not need payment setup.',
      }
    }

    // 4. Calculate rate
    const calculatedAmount = calculateMahadRate(
      profile.graduationStatus,
      profile.paymentFrequency,
      profile.billingType
    )

    if (calculatedAmount <= 0) {
      return {
        success: false,
        error: 'Invalid rate calculation. Please verify billing configuration.',
      }
    }

    // 5. Determine final amount (override or calculated)
    const isOverride = overrideAmount !== undefined && overrideAmount > 0
    const finalAmount = isOverride ? overrideAmount : calculatedAmount

    // 6. Validate override amount if provided
    if (isOverride) {
      if (finalAmount <= 0) {
        return {
          success: false,
          error: 'Override amount must be greater than 0',
        }
      }
      if (finalAmount > MAX_EXPECTED_RATE_CENTS * 2) {
        logger.warn(
          { finalAmount, profileId },
          'Override amount exceeds 2x max expected rate'
        )
      }
    }

    // 7. Validate email exists
    const emailContact = profile.person.contactPoints.find(
      (cp) => cp.type === 'EMAIL'
    )
    const phoneContact = profile.person.contactPoints.find(
      (cp) => cp.type === 'PHONE' || cp.type === 'WHATSAPP'
    )
    const email = emailContact?.value

    if (!email) {
      return {
        success: false,
        error:
          'Student email address is required for payment setup. Please add an email first.',
      }
    }

    // 8. Validate app URL configuration
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    if (!appUrl) {
      return {
        success: false,
        error: 'App URL not configured. Please set NEXT_PUBLIC_APP_URL.',
      }
    }

    // 9. Get validated product ID
    const { productId } = getMahadKeys()
    if (!productId) {
      return {
        success: false,
        error:
          'Stripe product not configured. Please set STRIPE_MAHAD_PRODUCT_ID.',
      }
    }

    // 10. Create Stripe checkout session
    const stripe = getMahadStripeClient()
    const intervalConfig = getStripeInterval(profile.paymentFrequency)

    // Calculate and validate billing_cycle_anchor if start date provided
    let billingCycleAnchor: number | undefined
    if (billingStartDate) {
      const startDate = new Date(billingStartDate)
      billingCycleAnchor = Math.floor(startDate.getTime() / 1000)
      validateBillingCycleAnchor(billingCycleAnchor)
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
      payment_method_types: ['card', 'us_bank_account'],
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
      success_url: `${appUrl}/mahad/register?success=true`,
      cancel_url: `${appUrl}/mahad/register?canceled=true`,
      allow_promotion_codes: true,
    })

    const billingPeriod =
      profile.paymentFrequency === 'BI_MONTHLY' ? '/2 months' : '/month'

    if (!session.url) {
      return {
        success: false,
        error: 'Failed to generate checkout URL. Please try again.',
      }
    }

    return {
      success: true,
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
      studentPhone: phoneContact?.value ?? null,
    }
  } catch (error) {
    logger.error(
      { err: error, profileId, overrideAmount },
      'Error generating payment link with override'
    )
    const message =
      error instanceof Error ? error.message : 'Failed to generate payment link'
    return { success: false, error: message }
  }
}
