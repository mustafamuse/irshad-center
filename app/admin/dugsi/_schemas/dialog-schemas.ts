import { z } from 'zod'

import {
  emailSchema,
  nameSchema,
  phoneSchema,
} from '@/lib/registration/schemas/registration'

// ============================================================================
// PARENT FORM SCHEMA
// ============================================================================

export const parentFormSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
})

export type ParentFormValues = z.infer<typeof parentFormSchema>

// ============================================================================
// CHILD FORM SCHEMA
// ============================================================================

export const childFormSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  gender: z.enum(['MALE', 'FEMALE'], {
    required_error: 'Gender is required',
  }),
  dateOfBirth: z.string().optional(),
  gradeLevel: z
    .enum([
      'KINDERGARTEN',
      'GRADE_1',
      'GRADE_2',
      'GRADE_3',
      'GRADE_4',
      'GRADE_5',
      'GRADE_6',
      'GRADE_7',
      'GRADE_8',
      'GRADE_9',
      'GRADE_10',
      'GRADE_11',
      'GRADE_12',
      'FRESHMAN',
      'SOPHOMORE',
      'JUNIOR',
      'SENIOR',
    ])
    .optional(),
  schoolName: z.string().optional(),
  healthInfo: z.string().optional(),
})

export type ChildFormValues = z.infer<typeof childFormSchema>

// ============================================================================
// CONSOLIDATE SUBSCRIPTION SCHEMA
// ============================================================================

export const consolidateSubscriptionSchema = z.object({
  stripeSubscriptionId: z
    .string()
    .min(1, 'Subscription ID is required')
    .regex(
      /^sub_/,
      'Must be a valid Stripe subscription ID (starts with sub_)'
    ),
})

export type ConsolidateSubscriptionFormValues = z.infer<
  typeof consolidateSubscriptionSchema
>

export const previewSubscriptionInputSchema = z.object({
  subscriptionId: z.string().regex(/^sub_/, 'Invalid Stripe subscription ID'),
  familyId: z.string().uuid('Invalid family ID'),
})

export const consolidateSubscriptionInputSchema = z.object({
  stripeSubscriptionId: z
    .string()
    .regex(/^sub_/, 'Invalid Stripe subscription ID'),
  familyId: z.string().uuid('Invalid family ID'),
  syncStripeCustomer: z.boolean(),
  forceOverride: z.boolean().optional(),
})
