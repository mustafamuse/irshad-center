import { StripeAccountType } from '@prisma/client'
import type { Logger } from 'pino'

import { DUGSI_PROGRAM } from '@/lib/constants/dugsi'
import { prisma } from '@/lib/db'
import { LIVE_SUBSCRIPTION_STATUSES } from '@/lib/db/query-builders'
import type { DatabaseClient } from '@/lib/db/types'
import { logError } from '@/lib/logger'

export async function findFamilySubscription(
  familyReferenceId: string | null,
  client: DatabaseClient = prisma
) {
  if (!familyReferenceId) return null

  const assignment = await client.billingAssignment.findFirst({
    where: {
      isActive: true,
      programProfile: {
        familyReferenceId,
        program: DUGSI_PROGRAM,
      },
      subscription: {
        stripeAccountType: StripeAccountType.DUGSI,
        status: { in: [...LIVE_SUBSCRIPTION_STATUSES, 'paused'] },
      },
    },
    include: { subscription: true },
    orderBy: { createdAt: 'desc' },
  })

  return assignment?.subscription ?? null
}

export async function findLiveFamilySubscriptionIds(
  familyReferenceId: string | null,
  client: DatabaseClient = prisma
): Promise<string[]> {
  if (!familyReferenceId) return []

  const assignments = await client.billingAssignment.findMany({
    where: {
      isActive: true,
      programProfile: {
        familyReferenceId,
        program: DUGSI_PROGRAM,
      },
      subscription: {
        stripeAccountType: StripeAccountType.DUGSI,
        status: { in: [...LIVE_SUBSCRIPTION_STATUSES, 'paused'] },
      },
    },
    select: { subscriptionId: true },
    distinct: ['subscriptionId'],
  })

  return assignments.map((a) => a.subscriptionId)
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
  return `${stripeAction} but DB update failed. Check logs for details.`
}
