import 'server-only'

import { z } from 'zod'

const envSchema = z
  .object({
    // ── Node / Vercel ────────────────────────────────────────────────────────────
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .optional()
      .default('development'),
    VERCEL_ENV: z.string().optional(),

    // ── Database ─────────────────────────────────────────────────────────────────
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    DIRECT_URL: z.string().optional(),

    // ── Admin Auth ───────────────────────────────────────────────────────────────
    ADMIN_PIN: z.string().min(1, 'ADMIN_PIN is required'),
    ADMIN_PASSWORD: z.string().min(1, 'ADMIN_PASSWORD is required'),

    // ── App Config ───────────────────────────────────────────────────────────────
    NEXT_PUBLIC_APP_URL: z
      .string()
      .url('NEXT_PUBLIC_APP_URL must be a valid URL'),

    // ── Email ────────────────────────────────────────────────────────────────────
    RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY is required'),
    EMAIL_FROM: z
      .string()
      .min(1)
      .optional()
      .default('Irshad Center <noreply@irshadcenter.com>'),
    ADMIN_EMAIL: z.string().email('ADMIN_EMAIL must be a valid email'),
    REPLY_TO_EMAIL: z.string().email().optional(),

    // ── Stripe — Mahad ───────────────────────────────────────────────────────────
    STRIPE_MAHAD_SECRET_KEY_TEST: z
      .string()
      .startsWith('sk_test_', 'Must start with sk_test_')
      .optional(),
    STRIPE_MAHAD_SECRET_KEY_LIVE: z
      .string()
      .startsWith('sk_live_', 'Must start with sk_live_')
      .optional(),
    STRIPE_MAHAD_WEBHOOK_SECRET_TEST: z
      .string()
      .startsWith('whsec_', 'Must start with whsec_')
      .optional(),
    STRIPE_MAHAD_WEBHOOK_SECRET_LIVE: z
      .string()
      .startsWith('whsec_', 'Must start with whsec_')
      .optional(),
    STRIPE_MAHAD_PRODUCT_ID: z
      .string()
      .startsWith('prod_', 'Must start with prod_')
      .optional(),
    STRIPE_MAHAD_PRODUCT_ID_TEST: z
      .string()
      .startsWith('prod_', 'Must start with prod_')
      .optional(),
    STRIPE_MAHAD_PRODUCT_ID_LIVE: z
      .string()
      .startsWith('prod_', 'Must start with prod_')
      .optional(),
    NEXT_PUBLIC_STRIPE_MAHAD_PUBLISHABLE_KEY_TEST: z
      .string()
      .startsWith('pk_test_', 'Must start with pk_test_')
      .optional(),
    NEXT_PUBLIC_STRIPE_MAHAD_PUBLISHABLE_KEY_LIVE: z
      .string()
      .startsWith('pk_live_', 'Must start with pk_live_')
      .optional(),
    NEXT_PUBLIC_STRIPE_MAHAD_PRICING_TABLE_ID: z.string().optional(),

    // ── Stripe — Dugsi ───────────────────────────────────────────────────────────
    STRIPE_DUGSI_SECRET_KEY_TEST: z
      .string()
      .startsWith('sk_test_', 'Must start with sk_test_')
      .optional(),
    STRIPE_DUGSI_SECRET_KEY_LIVE: z
      .string()
      .startsWith('sk_live_', 'Must start with sk_live_')
      .optional(),
    STRIPE_DUGSI_WEBHOOK_SECRET_TEST: z
      .string()
      .startsWith('whsec_', 'Must start with whsec_')
      .optional(),
    STRIPE_DUGSI_WEBHOOK_SECRET_LIVE: z
      .string()
      .startsWith('whsec_', 'Must start with whsec_')
      .optional(),
    STRIPE_DUGSI_PRODUCT_ID: z
      .string()
      .startsWith('prod_', 'Must start with prod_')
      .optional(),
    NEXT_PUBLIC_STRIPE_DUGSI_PUBLISHABLE_KEY_TEST: z
      .string()
      .startsWith('pk_test_', 'Must start with pk_test_')
      .optional(),
    NEXT_PUBLIC_STRIPE_DUGSI_PUBLISHABLE_KEY_LIVE: z
      .string()
      .startsWith('pk_live_', 'Must start with pk_live_')
      .optional(),
    NEXT_PUBLIC_STRIPE_DUGSI_PAYMENT_LINK: z.string().url().optional(),

    // ── Stripe — Zakat / Donation ────────────────────────────────────────────────
    STRIPE_ZAKAT_FITR_PRODUCT_ID: z
      .string()
      .startsWith('prod_', 'Must start with prod_')
      .optional(),
    STRIPE_DONATION_SECRET_KEY_TEST: z
      .string()
      .startsWith('sk_test_', 'Must start with sk_test_')
      .optional(),
    STRIPE_DONATION_SECRET_KEY_LIVE: z
      .string()
      .startsWith('sk_live_', 'Must start with sk_live_')
      .optional(),
    STRIPE_DONATION_WEBHOOK_SECRET_TEST: z
      .string()
      .startsWith('whsec_', 'Must start with whsec_')
      .optional(),
    STRIPE_DONATION_WEBHOOK_SECRET_LIVE: z
      .string()
      .startsWith('whsec_', 'Must start with whsec_')
      .optional(),
    STRIPE_DONATION_PRODUCT_ID: z
      .string()
      .startsWith('prod_', 'Must start with prod_')
      .optional(),

    // ── WhatsApp ─────────────────────────────────────────────────────────────────
    WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
    WHATSAPP_ACCESS_TOKEN: z.string().optional(),
    // Required for webhook signature verification (project rule #11).
    // If WHATSAPP_PHONE_NUMBER_ID is set, this must also be set.
    WHATSAPP_APP_SECRET: z.string().optional(),
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().optional(),
    WHATSAPP_DEFAULT_LANGUAGE: z.string().optional().default('en'),

    // ── Feature Flags ────────────────────────────────────────────────────────────
    DUGSI_CARD_PAYMENTS_ENABLED: z.string().optional(),
    MAHAD_CARD_PAYMENTS_ENABLED: z.string().optional(),
    NEXT_PUBLIC_SHOW_GRADE_SCHOOL: z.string().optional(),

    // ── Sentry ───────────────────────────────────────────────────────────────────
    SENTRY_DSN: z.string().optional(),
    NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
    SENTRY_ORG: z.string().optional(),
    SENTRY_PROJECT: z.string().optional(),
    SENTRY_RELEASE: z.string().optional(),
    SENTRY_DEBUG: z.string().optional(),
    NEXT_PUBLIC_SENTRY_DEBUG: z.string().optional(),
    NEXT_PUBLIC_SENTRY_RELEASE: z.string().optional(),

    // ── Axiom ────────────────────────────────────────────────────────────────────
    NEXT_PUBLIC_AXIOM_DATASET: z.string().optional(),
    NEXT_PUBLIC_AXIOM_TOKEN: z.string().optional(),

    // ── Logging ──────────────────────────────────────────────────────────────────
    PINO_LOG_LEVEL: z
      .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
      .optional(),

    // ── Geofence ─────────────────────────────────────────────────────────────────
    IRSHAD_CENTER_LAT: z.coerce.number().min(-90).max(90).optional(),
    IRSHAD_CENTER_LNG: z.coerce.number().min(-180).max(180).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.WHATSAPP_PHONE_NUMBER_ID && !data.WHATSAPP_APP_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'WHATSAPP_APP_SECRET is required when WHATSAPP_PHONE_NUMBER_ID is set (project rule #11: webhook signatures must be verified)',
        path: ['WHATSAPP_APP_SECRET'],
      })
    }
  })

const result = envSchema.safeParse(process.env)

if (!result.success) {
  console.error('❌ Environment validation failed:')
  console.error(JSON.stringify(result.error.format(), null, 2))
  throw new Error(
    'Missing or invalid environment variables. Check the error above and your .env.local file.'
  )
}

export const env = result.data

export type Env = z.infer<typeof envSchema>
