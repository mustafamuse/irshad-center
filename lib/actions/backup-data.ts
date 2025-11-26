'use server'

import { logger } from '@/lib/logger'

/**
 * Data Backup Action
 *
 * IMPORTANT: This backup utility needs migration to the new schema.
 * The Student model no longer exists.
 * TODO: Priority migration in PR 2e.
 */

export async function backupData() {
  logger.warn(
    { feature: 'backup', reason: 'schema_migration' },
    'Feature disabled during schema migration'
  )
  return {
    success: false,
    error: 'Backup functionality needs migration to new schema.',
  }
}
