import { StripeAccountType } from '@prisma/client'

import { DUGSI_PROGRAM } from '@/lib/constants/dugsi'
import { prisma } from '@/lib/db'

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
