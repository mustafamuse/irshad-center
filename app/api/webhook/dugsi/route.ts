import { NextResponse } from 'next/server'

import { createActionLogger, logWarning } from '@/lib/logger'

/**
 * Dugsi Webhook Handler
 *
 * MIGRATION NOTE (PR 2c):
 * This webhook is temporarily disabled during schema migration.
 * The Student model no longer exists - requires migration to ProgramProfile.
 *
 * Impact:
 * - Stripe events will return 501 and be retried by Stripe
 * - Payment confirmations not recorded during migration window
 * - Subscription status updates missed during migration window
 *
 * Mitigation:
 * - Stripe automatically retries webhooks for up to 3 days
 * - Migration window is expected to be < 24 hours
 * - Will be re-enabled in PR 2e with new schema support
 *
 * After migration, replay any missed events using:
 * ```bash
 * stripe events list --limit 100 --created[gte]=<migration_start_timestamp>
 * ```
 *
 * TODO: Priority migration in PR 2e.
 */
const logger = createActionLogger('dugsi_webhook')

export async function POST() {
  await logWarning(logger, 'dugsi_webhook disabled', {
    reason: 'schema_migration',
  })
  return NextResponse.json(
    { error: 'Dugsi webhook needs migration to new schema.' },
    { status: 501 }
  )
}
