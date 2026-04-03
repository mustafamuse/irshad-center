'use server'

import { getBatchDropdownOptions } from '@/lib/db/queries/batch'
import { createActionLogger, logWarning } from '@/lib/logger'
import { adminActionClient } from '@/lib/safe-action'

const logger = createActionLogger('mahad-payments')

export const getBatchesForFilter = adminActionClient
  .metadata({ actionName: 'getBatchesForFilter' })
  .action(async () => {
    return await getBatchDropdownOptions()
  })

/**
 * @deprecated This backfill script needs migration to the new ProgramProfile-based schema.
 * The StudentPayment model now uses programProfileId instead of studentId.
 * TODO: Migrate in PR 2e when API routes are updated.
 */
export async function runPaymentsBackfill() {
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
