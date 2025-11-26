'use server'

/**
 * Data Backup Action
 *
 * IMPORTANT: This backup utility needs migration to the new schema.
 * The Student model no longer exists.
 * TODO: Priority migration in PR 2e.
 */

export async function backupData() {
  console.error('[BACKUP] Backup disabled during schema migration')
  return {
    success: false,
    error: 'Backup functionality needs migration to new schema.',
  }
}
