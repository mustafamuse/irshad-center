'use server'

/**
 * Data Backup Action
 *
 * IMPORTANT: This backup utility needs migration to the new schema.
 * The Student model no longer exists.
 * TODO: Priority migration in PR 2e.
 */

import { createStubbedAction } from '@/lib/utils/stub-helpers'

export const backupData = createStubbedAction({
  feature: 'backup',
  reason: 'schema_migration',
})
