import 'server-only'

import { z } from 'zod'

// Coerces blank env var values ("") to undefined so optional() works correctly.
// Node.js (via dotenv) loads vars set to empty values (KEY=) as "" not undefined.
const stripeField = (prefix: string) =>
  z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().startsWith(prefix, `Must start with ${prefix}`).optional()
  )

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
    // NEXT_PUBLIC_* vars are inlined by Next.js at build time. Client-side code
    // must read them via process.env directly — server-only prevents this module
    // from being imported in client components. The schema's role for these is
    // startup format-checking.
    // Required in production — superRefine below rejects localhost values.
    // Default is for local development only.
    NEXT_PUBLIC_APP_URL: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z
        .string()
        .url('NEXT_PUBLIC_APP_URL must be a valid URL')
        .optional()
        .default('http://localhost:3000')
    ),

    // ── Email ────────────────────────────────────────────────────────────────────
    RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY is required'),
    EMAIL_FROM: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z
        .string()
        .min(1)
        .optional()
        .default('Irshad Center <noreply@irshadcenter.com>')
    ),
    ADMIN_EMAIL: z.string().email('ADMIN_EMAIL must be a valid email'),
    REPLY_TO_EMAIL: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.string().email().optional()
    ),

    // ── Stripe — Mahad ───────────────────────────────────────────────────────────
    STRIPE_MAHAD_SECRET_KEY_TEST: stripeField('sk_test_'),
    STRIPE_MAHAD_SECRET_KEY_LIVE: stripeField('sk_live_'),
    STRIPE_MAHAD_WEBHOOK_SECRET_TEST: stripeField('whsec_'),
    STRIPE_MAHAD_WEBHOOK_SECRET_LIVE: stripeField('whsec_'),
    // Mahad product ID resolution (lib/keys/stripe.ts): production → LIVE || generic,
    // non-production → TEST || generic. Dugsi uses a single STRIPE_DUGSI_PRODUCT_ID.
    STRIPE_MAHAD_PRODUCT_ID: stripeField('prod_'),
    STRIPE_MAHAD_PRODUCT_ID_TEST: stripeField('prod_'),
    STRIPE_MAHAD_PRODUCT_ID_LIVE: stripeField('prod_'),
    NEXT_PUBLIC_STRIPE_MAHAD_PUBLISHABLE_KEY_TEST: stripeField('pk_test_'),
    NEXT_PUBLIC_STRIPE_MAHAD_PUBLISHABLE_KEY_LIVE: stripeField('pk_live_'),
    NEXT_PUBLIC_STRIPE_MAHAD_PRICING_TABLE_ID: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.string().optional()
    ),

    // ── Stripe — Dugsi ───────────────────────────────────────────────────────────
    STRIPE_DUGSI_SECRET_KEY_TEST: stripeField('sk_test_'),
    STRIPE_DUGSI_SECRET_KEY_LIVE: stripeField('sk_live_'),
    STRIPE_DUGSI_WEBHOOK_SECRET_TEST: stripeField('whsec_'),
    STRIPE_DUGSI_WEBHOOK_SECRET_LIVE: stripeField('whsec_'),
    STRIPE_DUGSI_PRODUCT_ID: stripeField('prod_'),
    NEXT_PUBLIC_STRIPE_DUGSI_PUBLISHABLE_KEY_TEST: stripeField('pk_test_'),
    NEXT_PUBLIC_STRIPE_DUGSI_PUBLISHABLE_KEY_LIVE: stripeField('pk_live_'),
    NEXT_PUBLIC_STRIPE_DUGSI_PAYMENT_LINK: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z
        .string()
        .url()
        .startsWith(
          'https://',
          'NEXT_PUBLIC_STRIPE_DUGSI_PAYMENT_LINK must use HTTPS'
        )
        .optional()
    ),

    // ── Stripe — Zakat / Donation ────────────────────────────────────────────────
    STRIPE_ZAKAT_FITR_PRODUCT_ID: stripeField('prod_'),
    STRIPE_DONATION_SECRET_KEY_TEST: stripeField('sk_test_'),
    STRIPE_DONATION_SECRET_KEY_LIVE: stripeField('sk_live_'),
    STRIPE_DONATION_WEBHOOK_SECRET_TEST: stripeField('whsec_'),
    STRIPE_DONATION_WEBHOOK_SECRET_LIVE: stripeField('whsec_'),
    STRIPE_DONATION_PRODUCT_ID: stripeField('prod_'),
    NEXT_PUBLIC_STRIPE_DONATION_PUBLISHABLE_KEY_TEST: stripeField('pk_test_'),
    NEXT_PUBLIC_STRIPE_DONATION_PUBLISHABLE_KEY_LIVE: stripeField('pk_live_'),

    // ── WhatsApp ─────────────────────────────────────────────────────────────────
    // All four vars below are required together when WHATSAPP_PHONE_NUMBER_ID is
    // set — enforced via superRefine below.
    WHATSAPP_PHONE_NUMBER_ID: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.string().optional()
    ),
    WHATSAPP_ACCESS_TOKEN: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.string().optional()
    ),
    WHATSAPP_APP_SECRET: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.string().optional()
    ),
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.string().optional()
    ),
    WHATSAPP_DEFAULT_LANGUAGE: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.string().optional().default('en')
    ),

    // ── Feature Flags ────────────────────────────────────────────────────────────
    // Consumed as === 'true' in lib/config/feature-flags.ts — enum catches typos at startup.
    DUGSI_CARD_PAYMENTS_ENABLED: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.enum(['true', 'false']).optional()
    ),
    MAHAD_CARD_PAYMENTS_ENABLED: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.enum(['true', 'false']).optional()
    ),
    NEXT_PUBLIC_SHOW_GRADE_SCHOOL: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.enum(['true', 'false']).optional()
    ),

    // ── Sentry ───────────────────────────────────────────────────────────────────
    SENTRY_DSN: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.string().url().optional()
    ),
    NEXT_PUBLIC_SENTRY_DSN: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.string().url().optional()
    ),
    SENTRY_ORG: z.string().optional(),
    SENTRY_PROJECT: z.string().optional(),
    SENTRY_RELEASE: z.string().optional(),
    SENTRY_DEBUG: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.enum(['true', 'false']).optional()
    ),
    NEXT_PUBLIC_SENTRY_DEBUG: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.enum(['true', 'false']).optional()
    ),
    NEXT_PUBLIC_SENTRY_RELEASE: z.string().optional(),

    // ── Axiom ────────────────────────────────────────────────────────────────────
    NEXT_PUBLIC_AXIOM_DATASET: z.string().optional(),
    // NEXT_PUBLIC_AXIOM_TOKEN is a write-only credential scoped to this dataset.
    // Intentionally public — required by next-axiom for client-side log forwarding.
    NEXT_PUBLIC_AXIOM_TOKEN: z.string().optional(),

    // ── Logging ──────────────────────────────────────────────────────────────────
    PINO_LOG_LEVEL: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).optional()
    ),

    // ── Geofence ─────────────────────────────────────────────────────────────────
    IRSHAD_CENTER_LAT: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.coerce.number().min(-90).max(90).optional()
    ),
    IRSHAD_CENTER_LNG: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.coerce.number().min(-180).max(180).optional()
    ),
  })
  .superRefine((data, ctx) => {
    if (data.WHATSAPP_PHONE_NUMBER_ID) {
      const required = [
        'WHATSAPP_ACCESS_TOKEN',
        'WHATSAPP_APP_SECRET',
        'WHATSAPP_WEBHOOK_VERIFY_TOKEN',
      ] as const
      for (const key of required) {
        if (!data[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${key} is required when WHATSAPP_PHONE_NUMBER_ID is set`,
            path: [key],
          })
        }
      }
    }

    if (
      data.NODE_ENV === 'production' &&
      data.VERCEL_ENV !== 'preview' &&
      data.NEXT_PUBLIC_APP_URL != null &&
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(
        data.NEXT_PUBLIC_APP_URL
      )
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'NEXT_PUBLIC_APP_URL must be set to a real URL in production',
        path: ['NEXT_PUBLIC_APP_URL'],
      })
    }

    // Donation keys are intentionally excluded — the feature is opt-in and absent keys disable it gracefully.
    if (data.NODE_ENV === 'production' && data.VERCEL_ENV !== 'preview') {
      const requiredInProduction = [
        'STRIPE_MAHAD_SECRET_KEY_LIVE',
        'STRIPE_MAHAD_WEBHOOK_SECRET_LIVE',
        'NEXT_PUBLIC_STRIPE_MAHAD_PUBLISHABLE_KEY_LIVE',
        'STRIPE_DUGSI_SECRET_KEY_LIVE',
        'STRIPE_DUGSI_WEBHOOK_SECRET_LIVE',
        'NEXT_PUBLIC_STRIPE_DUGSI_PUBLISHABLE_KEY_LIVE',
      ] as const
      for (const key of requiredInProduction) {
        if (!data[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${key} is required in production`,
            path: [key],
          })
        }
      }
    }

    const hasLat = data.IRSHAD_CENTER_LAT !== undefined
    const hasLng = data.IRSHAD_CENTER_LNG !== undefined
    if (hasLat !== hasLng) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'IRSHAD_CENTER_LAT and IRSHAD_CENTER_LNG must both be set or both be absent',
        path: [hasLat ? 'IRSHAD_CENTER_LNG' : 'IRSHAD_CENTER_LAT'],
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
