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
    .optional()
    .default('umpp101@gmail.com'),
  REPLY_TO_EMAIL: z.string().email().optional(),

  // Node Environment
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .optional()
    .default('development'),
})

/**
 * Validated and type-safe environment variables
 * Fails fast on app startup if required variables are missing
 */
export const env = envSchema.parse({
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  REPLY_TO_EMAIL: process.env.REPLY_TO_EMAIL,
  NODE_ENV: process.env.NODE_ENV,
})

/**
 * Type-safe environment variable access
 * Use this instead of process.env for validated variables
 */
export type Env = z.infer<typeof envSchema>
