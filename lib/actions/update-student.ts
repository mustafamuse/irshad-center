'use server'

import { logger } from '@/lib/logger'

/**
 * Update Student Action
 *
 * IMPORTANT: This action needs migration to the new schema.
 * The Student model no longer exists.
 * TODO: Priority migration in PR 2e.
 */

export async function updateStudent(
  _id: string,
  _data: Record<string, unknown>
) {
  logger.warn(
    { feature: 'updateStudent', reason: 'schema_migration' },
    'Feature disabled during schema migration'
  )
  return {
    success: false,
    error: 'Student update needs migration to new schema.',
  }
}
