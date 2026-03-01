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

const stripeSecretKeySchema = z.string().startsWith('sk_')
const stripeWebhookSecretSchema = z.string().startsWith('whsec_')
const stripePublishableKeySchema = z.string().startsWith('pk_')
const stripeProductIdSchema = z.string().startsWith('prod_')

const stripeProgramConfigSchema = z.object({
  secretKey: stripeSecretKeySchema,
  webhookSecret: stripeWebhookSecretSchema,
  publishableKey: stripePublishableKeySchema.optional(),
  productId: z.string().optional(),
})

export type StripeProgramConfig = z.infer<typeof stripeProgramConfigSchema>

interface MahadConfig extends StripeProgramConfig {
  pricingTableId?: string
}

interface DugsiConfig extends StripeProgramConfig {
  paymentLink?: string
  productId?: string
}

export interface StripeKeysConfig {
  mahad: MahadConfig
  dugsi: DugsiConfig
  youth: MahadConfig | null
  donation: StripeProgramConfig | null
}

/**
 * Resolve an env var with test/live fallback.
 * In production: returns the live value.
 * In development: returns the test value, falling back to live.
 */
function resolveEnvKey(
  isProduction: boolean,
  testKey: string,
  liveKey: string
): string | undefined {
  if (isProduction) {
    return process.env[liveKey]
  }
  return process.env[testKey] || process.env[liveKey]
}

/**
 * Validate a StripeProgramConfig and throw descriptive errors if invalid.
 */
function validateProgramConfig(
  config: StripeProgramConfig,
  programName: string
): void {
  if (!stripeSecretKeySchema.safeParse(config.secretKey).success) {
    throw new Error(
      `${programName} Stripe secret key not configured or invalid format. ` +
        `Must start with sk_.`
    )
  }

  if (!stripeWebhookSecretSchema.safeParse(config.webhookSecret).success) {
    throw new Error(
      `${programName} Stripe webhook secret not configured or invalid format. ` +
        `Must start with whsec_.`
    )
  }

  if (
    config.productId &&
    !stripeProductIdSchema.safeParse(config.productId).success
  ) {
    throw new Error(
      `${programName} Stripe product ID has invalid format. ` +
        `Must start with prod_.`
    )
  }
}

/**
 * Get Stripe keys for all programs.
 * Automatically selects test or live keys based on NODE_ENV.
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
    productId: isProduction
      ? process.env.STRIPE_MAHAD_PRODUCT_ID_LIVE ||
        process.env.STRIPE_MAHAD_PRODUCT_ID
      : process.env.STRIPE_MAHAD_PRODUCT_ID_TEST ||
        process.env.STRIPE_MAHAD_PRODUCT_ID,
    pricingTableId: process.env.NEXT_PUBLIC_STRIPE_MAHAD_PRICING_TABLE_ID,
  }

  const dugsiConfig: DugsiConfig = {
    secretKey: resolveEnvKey(
      isProduction,
      'STRIPE_DUGSI_SECRET_KEY_TEST',
      'STRIPE_DUGSI_SECRET_KEY_LIVE'
    )!,
    webhookSecret: resolveEnvKey(
      isProduction,
      'STRIPE_DUGSI_WEBHOOK_SECRET_TEST',
      'STRIPE_DUGSI_WEBHOOK_SECRET_LIVE'
    )!,
    publishableKey: resolveEnvKey(
      isProduction,
      'NEXT_PUBLIC_STRIPE_DUGSI_PUBLISHABLE_KEY_TEST',
      'NEXT_PUBLIC_STRIPE_DUGSI_PUBLISHABLE_KEY_LIVE'
    ),
    paymentLink: process.env.NEXT_PUBLIC_STRIPE_DUGSI_PAYMENT_LINK,
    productId: process.env.STRIPE_DUGSI_PRODUCT_ID,
  }

  const donationSecretKey = resolveEnvKey(
    isProduction,
    'STRIPE_DONATION_SECRET_KEY_TEST',
    'STRIPE_DONATION_SECRET_KEY_LIVE'
  )
  const donationWebhookSecret = resolveEnvKey(
    isProduction,
    'STRIPE_DONATION_WEBHOOK_SECRET_TEST',
    'STRIPE_DONATION_WEBHOOK_SECRET_LIVE'
  )

  const donationConfig: StripeProgramConfig | null =
    donationSecretKey && donationWebhookSecret
      ? {
          secretKey: donationSecretKey,
          webhookSecret: donationWebhookSecret,
          publishableKey: resolveEnvKey(
            isProduction,
            'NEXT_PUBLIC_STRIPE_DONATION_PUBLISHABLE_KEY_TEST',
            'NEXT_PUBLIC_STRIPE_DONATION_PUBLISHABLE_KEY_LIVE'
          ),
          productId: process.env.STRIPE_DONATION_PRODUCT_ID,
        }
      : null

  return {
    mahad: mahadConfig,
    dugsi: dugsiConfig,
    youth: null,
    donation: donationConfig,
  }
}

/**
 * Get Mahad Stripe configuration.
 * Validates keys with Zod and throws if missing or malformed.
 */
export function getMahadKeys(): MahadConfig {
  const config = keys().mahad
  validateProgramConfig(config, 'Mahad')
  return config
}

/**
 * Get Dugsi Stripe configuration.
 * Validates keys with Zod and throws if missing or malformed.
 */
export function getDugsiKeys(): DugsiConfig {
  const config = keys().dugsi
  validateProgramConfig(config, 'Dugsi')
  return config
}

/**
 * Get Donation Stripe configuration.
 * Validates keys with Zod and throws if missing or malformed.
 */
export function getDonationKeys(): StripeProgramConfig {
  const config = keys().donation

  if (!config) {
    throw new Error(
      'Donation Stripe keys not configured. ' +
        'Please set STRIPE_DONATION_SECRET_KEY_TEST and STRIPE_DONATION_WEBHOOK_SECRET_TEST.'
    )
  }

  validateProgramConfig(config, 'Donation')
  return config
}

/**
 * Get Stripe configuration for a specific program.
 * Falls back to Mahad keys for Youth program.
 */
export function getKeysForProgram(
  program: 'MAHAD' | 'DUGSI' | 'YOUTH_EVENTS' | 'GENERAL_DONATION'
): StripeProgramConfig {
  switch (program) {
    case 'MAHAD':
      return getMahadKeys()
    case 'DUGSI':
      return getDugsiKeys()
    case 'GENERAL_DONATION':
      return getDonationKeys()
    case 'YOUTH_EVENTS':
      return getMahadKeys()
    default: {
      const _exhaustiveCheck: never = program
      throw new Error(`Unknown program: ${_exhaustiveCheck}`)
    }
  }
}
