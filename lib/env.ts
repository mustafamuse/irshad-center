import { z } from 'zod'

/**
 * Validates required environment variables at app startup
 */
const envSchema = z.object({
  // Resend Email Service
  RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY is required'),
  EMAIL_FROM: z
    .string()
    .min(1, 'EMAIL_FROM is required')
    .optional()
    .default('Irshad Center <noreply@irshadcenter.com>'),
  ADMIN_EMAIL: z
    .string()
    .email('ADMIN_EMAIL must be a valid email')
    .min(1, 'ADMIN_EMAIL is required'),
  REPLY_TO_EMAIL: z.string().email().optional(),

  // Node Environment
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .optional()
    .default('development'),
})

// Validate environment variables with helpful error messages
const result = envSchema.safeParse({
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  REPLY_TO_EMAIL: process.env.REPLY_TO_EMAIL,
  NODE_ENV: process.env.NODE_ENV,
})

if (!result.success) {
  console.error('❌ Environment validation failed:')
  console.error(JSON.stringify(result.error.format(), null, 2))
  throw new Error(
    'Missing or invalid environment variables. Check the error above and your .env.local file.'
  )
}

/**
 * Validated and type-safe environment variables
 * Safe to use throughout the application
 *
 * @example
 * import { env } from '@/lib/env'
 * const apiKey = env.RESEND_API_KEY // Type-safe!
 */
export const env = result.data

/**
 * Type for validated environment variables
 */
export type Env = z.infer<typeof envSchema>
