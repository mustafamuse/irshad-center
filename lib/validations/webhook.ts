import { z } from 'zod'

/**
 * Validation schemas for webhook data from Stripe custom fields.
 * These are more lenient than registration schemas since the data
 * comes from external sources and we want to be forgiving.
 */

/**
 * Validates student name from Stripe custom field.
 * Allows letters, spaces, hyphens, and apostrophes.
 */
export const webhookStudentNameSchema = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name must be less than 100 characters')
  .regex(
    /^[a-zA-Z\s'-]+$/,
    'Name can only contain letters, spaces, apostrophes, and hyphens'
  )
  .transform((name) => name.replace(/\s+/g, ' ')) // Normalize multiple spaces
  .optional()

/**
 * Validates phone number from Stripe custom field.
 * Expects numeric string after normalization (10-15 digits).
 */
export const webhookPhoneSchema = z
  .string()
  .regex(/^\d{10,15}$/, 'Phone must be 10-15 digits after normalization')
  .optional()

/**
 * Validates email from Stripe customer details.
 */
export const webhookEmailSchema = z
  .string()
  .email('Invalid email format')
  .max(255, 'Email too long')
  .toLowerCase() // Normalize to lowercase for matching
  .optional()

/**
 * Helper function to safely validate webhook data
 * Returns null if validation fails or if the data is undefined
 */
export function validateWebhookData<T>(
  data: unknown,
  schema: z.ZodSchema<T>,
  fieldName: string
): T extends string | undefined ? string | null : T | null {
  const result = schema.safeParse(data)

  if (!result.success) {
    console.warn(
      `[WEBHOOK] Invalid ${fieldName} received:`,
      data,
      'Errors:',
      result.error.issues.map((i) => i.message).join(', ')
    )
    return null as any
  }

  // Handle optional schemas that might return undefined
  if (result.data === undefined) {
    return null as any
  }

  return result.data as any
}
