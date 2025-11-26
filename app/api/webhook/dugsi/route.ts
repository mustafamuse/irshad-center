import { NextResponse } from 'next/server'

import { logger } from '@/lib/logger'

/**
 * Dugsi Webhook Handler
 *
 * IMPORTANT: This webhook needs migration to the new schema.
 * The Student model no longer exists.
 * TODO: Priority migration in PR 2e.
 */
export async function POST() {
  logger.warn(
    { webhook: 'dugsi', reason: 'schema_migration' },
    'Webhook disabled during schema migration'
  )
  return NextResponse.json(
    { error: 'Dugsi webhook needs migration to new schema.' },
    { status: 501 }
  )
}
