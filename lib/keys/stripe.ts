/**
 * Centralized Stripe Keys Management
 *
 * Type-safe access to Stripe environment variables with Zod validation.
 * Automatically switches between test/live keys based on NODE_ENV.
 *
 * Pattern: STRIPE_{PROGRAM}_{TYPE}_{ENV}
 *
 * @example
 * import { keys } from '@/lib/keys/stripe'
 * const mahadSecretKey = keys().mahad.secretKey
 */

import { z } from 'zod'

// Validation schemas for Stripe key formats
const stripeSecretKeySchema = z.string().startsWith('sk_')
const stripeWebhookSecretSchema = z.string().startsWith('whsec_')
const stripePublishableKeySchema = z.string().startsWith('pk_')
const stripeProductIdSchema = z.string().startsWith('prod_')

// Schema for a program's Stripe configuration
const stripeProgramConfigSchema = z.object({
  secretKey: stripeSecretKeySchema,
  webhookSecret: stripeWebhookSecretSchema,
  publishableKey: stripePublishableKeySchema.optional(),
  productId: z.string().optional(),
})

export type StripeProgramConfig = z.infer<typeof stripeProgramConfigSchema>

// Mahad-specific config (includes pricing table)
interface MahadConfig extends StripeProgramConfig {
  pricingTableId?: string
}

// Dugsi-specific config (includes payment link)
interface DugsiConfig extends StripeProgramConfig {
  paymentLink?: string
}

// Full Stripe keys configuration
export interface StripeKeysConfig {
  mahad: MahadConfig
  dugsi: DugsiConfig
  youth: MahadConfig | null
  donation: MahadConfig | null
}

/**
 * Get Stripe keys for all programs.
 * Automatically selects test or live keys based on NODE_ENV.
 *
 * @returns Stripe configuration for all programs
 */
export function keys(): StripeKeysConfig {
  const isProduction = process.env.NODE_ENV === 'production'

  const mahadConfig: MahadConfig = {
    secretKey: isProduction
      ? process.env.STRIPE_MAHAD_SECRET_KEY_LIVE!
      : process.env.STRIPE_MAHAD_SECRET_KEY_TEST!,
    webhookSecret: isProduction
      ? process.env.STRIPE_MAHAD_WEBHOOK_SECRET_LIVE!
      : process.env.STRIPE_MAHAD_WEBHOOK_SECRET_TEST!,
    publishableKey: isProduction
      ? process.env.NEXT_PUBLIC_STRIPE_MAHAD_PUBLISHABLE_KEY_LIVE
      : process.env.NEXT_PUBLIC_STRIPE_MAHAD_PUBLISHABLE_KEY_TEST,
    productId: process.env.STRIPE_MAHAD_PRODUCT_ID,
    pricingTableId: process.env.NEXT_PUBLIC_STRIPE_MAHAD_PRICING_TABLE_ID,
  }

  // Dugsi: Fall back to live keys if test keys aren't configured yet
  const dugsiSecretKey = isProduction
    ? process.env.STRIPE_DUGSI_SECRET_KEY_LIVE!
    : process.env.STRIPE_DUGSI_SECRET_KEY_TEST ||
      process.env.STRIPE_DUGSI_SECRET_KEY_LIVE!

  const dugsiWebhookSecret = isProduction
    ? process.env.STRIPE_DUGSI_WEBHOOK_SECRET_LIVE!
    : process.env.STRIPE_DUGSI_WEBHOOK_SECRET_TEST ||
      process.env.STRIPE_DUGSI_WEBHOOK_SECRET_LIVE!

  const dugsiPublishableKey = isProduction
    ? process.env.NEXT_PUBLIC_STRIPE_DUGSI_PUBLISHABLE_KEY_LIVE
    : process.env.NEXT_PUBLIC_STRIPE_DUGSI_PUBLISHABLE_KEY_TEST ||
      process.env.NEXT_PUBLIC_STRIPE_DUGSI_PUBLISHABLE_KEY_LIVE

  const dugsiConfig: DugsiConfig = {
    secretKey: dugsiSecretKey,
    webhookSecret: dugsiWebhookSecret,
    publishableKey: dugsiPublishableKey,
    paymentLink: process.env.NEXT_PUBLIC_STRIPE_DUGSI_PAYMENT_LINK,
  }

  return {
    mahad: mahadConfig,
    dugsi: dugsiConfig,
    // Youth & Donation default to null - will use Mahad's keys as fallback
    youth: null,
    donation: null,
  }
}

/**
 * Get Mahad Stripe configuration.
 * Validates keys with Zod and throws if missing or malformed.
 */
export function getMahadKeys(): MahadConfig {
  const config = keys().mahad

  // Validate required keys with Zod schemas
  const secretKeyResult = stripeSecretKeySchema.safeParse(config.secretKey)
  if (!secretKeyResult.success) {
    throw new Error(
      'Mahad Stripe secret key not configured or invalid format. ' +
        'Please set STRIPE_MAHAD_SECRET_KEY_TEST and STRIPE_MAHAD_SECRET_KEY_LIVE (must start with sk_).'
    )
  }

  const webhookSecretResult = stripeWebhookSecretSchema.safeParse(
    config.webhookSecret
  )
  if (!webhookSecretResult.success) {
    throw new Error(
      'Mahad Stripe webhook secret not configured or invalid format. ' +
        'Please set STRIPE_MAHAD_WEBHOOK_SECRET_TEST and STRIPE_MAHAD_WEBHOOK_SECRET_LIVE (must start with whsec_).'
    )
  }

  // Validate product ID if provided
  if (config.productId) {
    const productIdResult = stripeProductIdSchema.safeParse(config.productId)
    if (!productIdResult.success) {
      throw new Error(
        'Mahad Stripe product ID has invalid format. ' +
          'Please set STRIPE_MAHAD_PRODUCT_ID (must start with prod_).'
      )
    }
  }

  return config
}

/**
 * Get Dugsi Stripe configuration.
 * Validates keys with Zod and throws if missing or malformed.
 */
export function getDugsiKeys(): DugsiConfig {
  const config = keys().dugsi

  // Validate required keys with Zod schemas
  const secretKeyResult = stripeSecretKeySchema.safeParse(config.secretKey)
  if (!secretKeyResult.success) {
    throw new Error(
      'Dugsi Stripe secret key not configured or invalid format. ' +
        'Please set STRIPE_DUGSI_SECRET_KEY_TEST and STRIPE_DUGSI_SECRET_KEY_LIVE (must start with sk_).'
    )
  }

  const webhookSecretResult = stripeWebhookSecretSchema.safeParse(
    config.webhookSecret
  )
  if (!webhookSecretResult.success) {
    throw new Error(
      'Dugsi Stripe webhook secret not configured or invalid format. ' +
        'Please set STRIPE_DUGSI_WEBHOOK_SECRET_TEST and STRIPE_DUGSI_WEBHOOK_SECRET_LIVE (must start with whsec_).'
    )
  }

  return config
}

/**
 * Get Stripe configuration for a specific program.
 * Falls back to Mahad keys for Youth and Donation programs.
 */
export function getKeysForProgram(
  program: 'MAHAD' | 'DUGSI' | 'YOUTH_EVENTS' | 'GENERAL_DONATION'
): MahadConfig | DugsiConfig {
  switch (program) {
    case 'MAHAD':
      return getMahadKeys()
    case 'DUGSI':
      return getDugsiKeys()
    case 'YOUTH_EVENTS':
    case 'GENERAL_DONATION':
      // Default to Mahad keys until they get their own
      return getMahadKeys()
    default: {
      const _exhaustiveCheck: never = program
      throw new Error(`Unknown program: ${_exhaustiveCheck}`)
    }
  }
}
