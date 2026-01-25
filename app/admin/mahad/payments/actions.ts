'use server'

import { prisma } from '@/lib/db'
import { createActionLogger, logError } from '@/lib/logger'

const logger = createActionLogger('mahad-payments')

export async function getBatchesForFilter() {
  try {
    const batches = await prisma.batch.findMany({
      select: {
        id: true,
        name: true,
      },
      where: {
        name: {
          not: 'Test',
        },
      },
      orderBy: {
        name: 'asc',
      },
    })
    return batches
  } catch (error) {
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
  'use server'
  console.warn(
    'runPaymentsBackfill is deprecated and needs migration to new schema'
  )
  return {
    success: false,
    message:
      'This backfill script needs migration to the new ProgramProfile-based schema.',
  }
}
