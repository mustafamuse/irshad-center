import { NextResponse } from 'next/server'

import { createActionLogger, logWarning } from '@/lib/logger'

/**
 * Dugsi Webhook Handler
 *
 * IMPORTANT: This webhook needs migration to the new schema.
 * The Student model no longer exists.
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
