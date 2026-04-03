'use server'

import { assertAdmin } from '@/lib/auth'
import { getBatchDropdownOptions } from '@/lib/db/queries/batch'
import { ActionError } from '@/lib/errors/action-error'
import { createActionLogger, logError, logWarning } from '@/lib/logger'

const logger = createActionLogger('mahad-payments')

export async function getBatchesForFilter() {
  try {
    await assertAdmin('getBatchesForFilter')
    return await getBatchDropdownOptions()
  } catch (error) {
    if (error instanceof ActionError) throw error
    await logError(logger, error, 'Failed to fetch batches for filter')
    return []
  }
}

/**
 * @deprecated This backfill script needs migration to the new ProgramProfile-based schema.
 * The StudentPayment model now uses programProfileId instead of studentId.
 * TODO: Migrate in PR 2e when API routes are updated.
 */
export async function runPaymentsBackfill() {
  try {
    await assertAdmin('runPaymentsBackfill')
  } catch {
    return { success: false, error: 'Unauthorized' }
  }
  await logWarning(
    logger,
    'runPaymentsBackfill is deprecated and needs migration to new schema'
  )
  return {
    success: false,
    error:
      'This backfill script needs migration to the new ProgramProfile-based schema.',
  }
}
