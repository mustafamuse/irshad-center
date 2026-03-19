import { EnrollmentStatus } from '@prisma/client'

import { DUGSI_PROGRAM } from '@/lib/constants/dugsi'
import { prisma } from '@/lib/db'
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { calculateDugsiRate } from '@/lib/utils/dugsi-tuition'

import { findFamilySubscription } from './billing-helpers'

const WITHDRAWABLE_STATUSES: EnrollmentStatus[] = ['REGISTERED', 'ENROLLED']

export interface WithdrawalPreview {
  childrenToWithdraw: Array<{ id: string; name: string }>
  currentRate: number
  newRate: number
  remainingCount: number
  removesAllChildren: boolean
  subscriptionStatus: string | null
  hasOverride: boolean
}

export async function getWithdrawalPreview(
  familyReferenceId: string,
  profileIds: string[]
): Promise<WithdrawalPreview> {
  const allFamilyProfiles = await prisma.programProfile.findMany({
    where: {
      familyReferenceId,
      program: DUGSI_PROGRAM,
      status: { in: WITHDRAWABLE_STATUSES },
    },
    include: {
      person: { select: { name: true } },
    },
  })

  if (allFamilyProfiles.length === 0) {
    throw new ActionError(
      'No active children found for this family',
      ERROR_CODES.FAMILY_NOT_FOUND
    )
  }

  const profilesToWithdraw = allFamilyProfiles.filter((p) =>
    profileIds.includes(p.id)
  )

  if (profilesToWithdraw.length !== profileIds.length) {
    const foundIds = new Set(profilesToWithdraw.map((p) => p.id))
    const missing = profileIds.filter((id) => !foundIds.has(id))
    throw new ActionError(
      `Some children not found or not eligible: ${missing.join(', ')}`,
      ERROR_CODES.INVALID_INPUT
    )
  }

  const currentActiveCount = allFamilyProfiles.length
  const remainingCount = currentActiveCount - profilesToWithdraw.length
  const currentRate = calculateDugsiRate(currentActiveCount)
  const newRate = calculateDugsiRate(remainingCount)

  const subscription = await findFamilySubscription(familyReferenceId)
  const hasOverride = subscription ? subscription.amount !== currentRate : false

  return {
    childrenToWithdraw: profilesToWithdraw.map((p) => ({
      id: p.id,
      name: p.person.name,
    })),
    currentRate: subscription?.amount ?? currentRate,
    newRate,
    remainingCount,
    removesAllChildren: remainingCount === 0,
    subscriptionStatus: subscription?.status ?? null,
    hasOverride,
  }
}
