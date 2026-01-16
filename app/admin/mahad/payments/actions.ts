'use server'

import { prisma } from '@/lib/db'
import { createActionLogger } from '@/lib/logger'

const logger = createActionLogger('mahad-payments')

type BatchFilterItem = { id: string; name: string }

type BatchFilterResult =
  | { success: true; data: BatchFilterItem[] }
  | { success: false; error: string }

export async function getBatchesForFilter(): Promise<BatchFilterResult> {
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
    return { success: true, data: batches }
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch batches')
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch batches',
    }
  }
}

/**
 * @deprecated This backfill script needs migration to the new ProgramProfile-based schema.
 * The StudentPayment model now uses programProfileId instead of studentId.
 * TODO: Migrate in PR 2e when API routes are updated.
 */
export async function runPaymentsBackfill() {
  'use server'
  logger.warn(
    'runPaymentsBackfill is deprecated and needs migration to new schema'
  )
  return {
    success: false,
    message:
      'This backfill script needs migration to the new ProgramProfile-based schema.',
  }
}
