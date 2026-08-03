import { EnrollmentStatus } from '@prisma/client'

import { DUGSI_PROGRAM } from '@/lib/constants/dugsi'
import { findFamilyProfilesForWithdrawal } from '@/lib/db/queries/program-profile'
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { calculateDugsiRate } from '@/lib/utils/dugsi-tuition'

import {
  findFamilySubscription,
  findLiveFamilySubscriptionIds,
} from './billing-helpers'

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
  requestedProfileIds: string[]
): Promise<WithdrawalPreview> {
  const profileIds = Array.from(new Set(requestedProfileIds))
  const liveSubscriptionIds =
    await findLiveFamilySubscriptionIds(familyReferenceId)
  if (liveSubscriptionIds.length > 1) {
    throw new ActionError(
      'This family has multiple active subscriptions. Consolidate billing before withdrawing children.',
      ERROR_CODES.ACTIVE_SUBSCRIPTION,
      undefined,
      409
    )
  }

  const allFamilyProfiles = await findFamilyProfilesForWithdrawal(
    familyReferenceId,
    DUGSI_PROGRAM,
    WITHDRAWABLE_STATUSES
  )

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
