import { StripeAccountType } from '@prisma/client'
import type { Logger } from 'pino'

import { DUGSI_PROGRAM } from '@/lib/constants/dugsi'
import { prisma } from '@/lib/db'
import { logError } from '@/lib/logger'

export async function findFamilySubscription(familyReferenceId: string | null) {
  if (!familyReferenceId) return null

  const assignment = await prisma.billingAssignment.findFirst({
    where: {
      isActive: true,
      programProfile: {
        familyReferenceId,
        program: DUGSI_PROGRAM,
      },
      subscription: {
        stripeAccountType: StripeAccountType.DUGSI,
        status: { in: ['active', 'paused'] },
      },
    },
    include: { subscription: true },
    orderBy: { createdAt: 'desc' },
  })

  return assignment?.subscription ?? null
}

export async function handleBillingDivergence(
  logger: Logger,
  dbError: unknown,
  stripeAction: string,
  context: Record<string, unknown>
): Promise<string> {
  await logError(
    logger,
    dbError,
    `CRITICAL: ${stripeAction} but DB update failed - states diverged`,
    context
  )
  return `${stripeAction} but DB update failed: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`
}
