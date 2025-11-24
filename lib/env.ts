import { z } from 'zod'

import { createLogger } from './logger'

const envLogger = createLogger({ source: 'env-validation' })

/**
 * Validates required environment variables at app startup
 *
 * This comprehensive schema ensures all critical configuration is present
 * and correctly formatted before the application starts.
 */
const envSchema = z.object({
  // ============================================================================
  // Node Environment
  // ============================================================================
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  // ============================================================================
  // Database Configuration
  // ============================================================================
  DATABASE_URL: z
    .string()
    .url('DATABASE_URL must be a valid URL')
    .startsWith(
      'postgresql://',
      'DATABASE_URL must be a PostgreSQL connection string'
    ),

  DIRECT_URL: z
    .string()
    .url('DIRECT_URL must be a valid URL')
    .startsWith(
      'postgresql://',
      'DIRECT_URL must be a PostgreSQL connection string'
    ),

  DATABASE_ENV: z
    .enum(['development', 'staging', 'production'])
    .optional()
    .default('development'),

  // ============================================================================
  // Stripe - Mahad Account
  // ============================================================================
  STRIPE_SECRET_KEY_PROD: z
    .string()
    .min(1, 'STRIPE_SECRET_KEY_PROD is required')
    .startsWith('sk_', 'Stripe secret key must start with sk_'),

  STRIPE_WEBHOOK_SECRET_PROD: z
    .string()
    .min(1, 'STRIPE_WEBHOOK_SECRET_PROD is required')
    .startsWith('whsec_', 'Stripe webhook secret must start with whsec_'),

  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z
    .string()
    .min(1, 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is required')
    .startsWith('pk_', 'Stripe publishable key must start with pk_'),

  // ============================================================================
  // Stripe - Dugsi Account
  // ============================================================================
  STRIPE_SECRET_KEY_DUGSI: z
    .string()
    .min(1, 'STRIPE_SECRET_KEY_DUGSI is required')
    .startsWith('sk_', 'Stripe secret key must start with sk_'),

  STRIPE_WEBHOOK_SECRET_DUGSI: z
    .string()
    .min(1, 'STRIPE_WEBHOOK_SECRET_DUGSI is required')
    .startsWith('whsec_', 'Stripe webhook secret must start with whsec_'),

  NEXT_PUBLIC_STRIPE_PAYMENT_LINK_DUGSI: z
    .string()
    .url('NEXT_PUBLIC_STRIPE_PAYMENT_LINK_DUGSI must be a valid URL')
    .optional(),

  // ============================================================================
  // Email Service (Resend)
  // ============================================================================
  RESEND_API_KEY: z
    .string()
    .min(1, 'RESEND_API_KEY is required')
    .startsWith('re_', 'Resend API key must start with re_'),

  EMAIL_FROM: z
    .string()
    .min(1, 'EMAIL_FROM is required')
    .default('Irshad Center <noreply@irshadcenter.com>'),

  ADMIN_EMAIL: z
    .string()
    .email('ADMIN_EMAIL must be a valid email')
    .min(1, 'ADMIN_EMAIL is required'),

  REPLY_TO_EMAIL: z
    .string()
    .email('REPLY_TO_EMAIL must be a valid email')
    .optional(),

  // ============================================================================
  // Security & Authentication
  // ============================================================================
  ADMIN_PASSWORD: z
    .string()
    .min(12, 'ADMIN_PASSWORD must be at least 12 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'ADMIN_PASSWORD must contain uppercase, lowercase, and numbers'
    ),

  CRON_SECRET_KEY: z
    .string()
    .min(32, 'CRON_SECRET_KEY must be at least 32 characters for security'),
})

// Validate environment variables with helpful error messages
const result = envSchema.safeParse({
  // Node
  NODE_ENV: process.env.NODE_ENV,

  // Database
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
  DATABASE_ENV: process.env.DATABASE_ENV,

  // Stripe - Mahad
  STRIPE_SECRET_KEY_PROD: process.env.STRIPE_SECRET_KEY_PROD,
  STRIPE_WEBHOOK_SECRET_PROD: process.env.STRIPE_WEBHOOK_SECRET_PROD,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,

  // Stripe - Dugsi
  STRIPE_SECRET_KEY_DUGSI: process.env.STRIPE_SECRET_KEY_DUGSI,
  STRIPE_WEBHOOK_SECRET_DUGSI: process.env.STRIPE_WEBHOOK_SECRET_DUGSI,
  NEXT_PUBLIC_STRIPE_PAYMENT_LINK_DUGSI:
    process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_DUGSI,

  // Email
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  REPLY_TO_EMAIL: process.env.REPLY_TO_EMAIL,

  // Security
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  CRON_SECRET_KEY: process.env.CRON_SECRET_KEY,
})

if (!result.success) {
  envLogger.fatal(
    { errors: result.error.format() },
    'Environment validation failed'
  )
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
