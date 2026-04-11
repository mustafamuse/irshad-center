import { GradeLevel, Shift } from '@prisma/client'
import { z } from 'zod'

import { SHIFT_FILTER_ALL } from '@/lib/constants/dugsi'

// ============================================================================
// FAMILY SHIFT VALIDATION
// ============================================================================

export const UpdateFamilyShiftSchema = z.object({
  familyReferenceId: z
    .string()
    .uuid('Invalid family reference ID format')
    .min(1, 'Family reference ID is required'),
  shift: z.nativeEnum(Shift, {
    errorMap: () => ({ message: 'Shift must be MORNING or AFTERNOON' }),
  }),
})

// ============================================================================
// SEARCH PARAMS VALIDATION
// ============================================================================

export const ShiftFilterSchema = z
  .enum([Shift.MORNING, Shift.AFTERNOON, SHIFT_FILTER_ALL])
  .optional()
  .transform((val) => {
    if (!val || val === SHIFT_FILTER_ALL) return undefined
    return val
  })

// ============================================================================
// SERVICE LAYER VALIDATION
// ============================================================================

export const DugsiRegistrationFiltersSchema = z.object({
  shift: z.enum([Shift.MORNING, Shift.AFTERNOON]).optional(),
})

// ============================================================================
// BILLING CONTROL VALIDATION
// ============================================================================

export const FamilyBillingControlSchema = z.object({
  familyReferenceId: z.string().uuid('Invalid family reference ID format'),
})

export const PauseFamilyBillingSchema = FamilyBillingControlSchema
export const ResumeFamilyBillingSchema = FamilyBillingControlSchema

// ============================================================================
// ADMIN ACTION SCHEMAS
// ============================================================================

export const StudentIdSchema = z.object({ studentId: z.string().min(1) })
export const SubscriptionIdSchema = z.object({
  subscriptionId: z.string().min(1),
})
export const ParentEmailSchema = z.object({ parentEmail: z.string().email() })
export const ClassIdSchema = z.object({ classId: z.string().min(1) })

export const LinkSubscriptionSchema = z.object({
  parentEmail: z.string().email(),
  subscriptionId: z.string().min(1),
})

export const VerifyBankSchema = z.object({
  paymentIntentId: z.string().min(1),
  descriptorCode: z.string().min(1),
})

export const UpdateParentInfoSchema = z.object({
  studentId: z.string().min(1),
  parentNumber: z.union([z.literal(1), z.literal(2)]),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().min(1),
})

export const AddSecondParentSchema = z.object({
  studentId: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
})

export const SetPrimaryPayerSchema = z.object({
  studentId: z.string().min(1),
  parentNumber: z.union([z.literal(1), z.literal(2)]),
})

export const UpdateChildInfoSchema = z.object({
  studentId: z.string().min(1),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE']).optional(),
  dateOfBirth: z.date().optional(),
  gradeLevel: z.nativeEnum(GradeLevel).optional(),
  schoolName: z.string().optional(),
  healthInfo: z.string().nullable().optional(),
})

export const AddChildToFamilySchema = z.object({
  existingStudentId: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  gender: z.enum(['MALE', 'FEMALE']),
  dateOfBirth: z.date().optional(),
  gradeLevel: z.nativeEnum(GradeLevel).optional(),
  schoolName: z.string().optional(),
  healthInfo: z.string().nullable().optional(),
})

export const GenerateFamilyPaymentLinkSchema = z.object({
  familyId: z.string().min(1),
  overrideAmount: z.number().optional(),
  billingStartDate: z.string().optional(),
})

export const BulkPaymentLinksSchema = z.object({
  familyIds: z.array(z.string()).min(1, 'At least one family must be selected'),
})

export const PaymentHistorySchema = z.object({
  customerId: z
    .string()
    .startsWith('cus_', 'Invalid Stripe customer ID format'),
})

export const SendPaymentLinkViaWhatsAppSchema = z.object({
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
// TYPE INFERENCE HELPERS
// ============================================================================

export type UpdateFamilyShiftInput = z.infer<typeof UpdateFamilyShiftSchema>
export type DugsiRegistrationFilters = z.infer<
  typeof DugsiRegistrationFiltersSchema
>
export type SendPaymentLinkViaWhatsAppInput = z.infer<
  typeof SendPaymentLinkViaWhatsAppSchema
>
