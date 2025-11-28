/**
 * Checkout Request Validation Schema
 *
 * Zod validation for Mahad checkout API requests.
 * Ensures type safety and validates enum values at runtime.
 */

import {
  GraduationStatus,
  PaymentFrequency,
  StudentBillingType,
} from '@prisma/client'
import { z } from 'zod'

/**
 * Schema for Mahad checkout session requests
 *
 * Validates:
 * - profileId is a valid UUID
 * - graduationStatus and paymentFrequency are valid enum values
 * - billingType is valid if provided
 * - successUrl/cancelUrl are valid URLs if provided
 */
export const CheckoutRequestSchema = z.object({
  profileId: z.string().uuid('Invalid profile ID format'),
  graduationStatus: z.nativeEnum(GraduationStatus, {
    errorMap: () => ({ message: 'Invalid graduation status' }),
  }),
  paymentFrequency: z.nativeEnum(PaymentFrequency, {
    errorMap: () => ({ message: 'Invalid payment frequency' }),
  }),
  billingType: z
    .nativeEnum(StudentBillingType, {
      errorMap: () => ({ message: 'Invalid billing type' }),
    })
    .optional(),
  successUrl: z
    .string()
    .url('Invalid success URL')
    .refine(
      (url) => url.startsWith('http://') || url.startsWith('https://'),
      'Success URL must use HTTP or HTTPS protocol'
    )
    .optional(),
  cancelUrl: z
    .string()
    .url('Invalid cancel URL')
    .refine(
      (url) => url.startsWith('http://') || url.startsWith('https://'),
      'Cancel URL must use HTTP or HTTPS protocol'
    )
    .optional(),
})

export type CheckoutRequestInput = z.infer<typeof CheckoutRequestSchema>

/**
 * Maximum expected rate in cents ($500)
 * Rates above this trigger a warning for anomaly detection
 */
export const MAX_EXPECTED_RATE_CENTS = 50000
