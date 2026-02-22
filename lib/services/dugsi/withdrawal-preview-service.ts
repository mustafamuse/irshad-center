import * as Sentry from '@sentry/nextjs'

import { DUGSI_PROGRAM } from '@/lib/constants/dugsi'
import { prisma } from '@/lib/db'
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { calculateDugsiRate } from '@/lib/utils/dugsi-tuition'

import { findFamilySubscription } from './billing-helpers'

export interface WithdrawPreview {
  childName: string
  activeChildrenCount: number
  currentAmount: number | null
  recalculatedAmount: number
  isLastActiveChild: boolean
  hasActiveSubscription: boolean
  isPaused: boolean
}

export interface WithdrawFamilyPreviewResult {
  count: number
  students: Array<{ id: string; name: string }>
}

export async function getWithdrawPreview(
  studentId: string
): Promise<WithdrawPreview> {
  return Sentry.startSpan(
    { name: 'withdrawal.getWithdrawPreview', op: 'function' },
    async () => {
      const profile = await prisma.programProfile.findUnique({
        where: { id: studentId },
        include: { person: true },
      })

      if (!profile || profile.program !== DUGSI_PROGRAM) {
        throw new ActionError(
          'Student not found',
          ERROR_CODES.STUDENT_NOT_FOUND,
          undefined,
          404
        )
      }

      const activeCount = await prisma.programProfile.count({
        where: {
          program: DUGSI_PROGRAM,
          familyReferenceId: profile.familyReferenceId,
          status: { in: ['REGISTERED', 'ENROLLED'] },
        },
      })
      const afterWithdrawalCount = activeCount - 1

      const subscription = await findFamilySubscription(
        profile.familyReferenceId
      )

      return {
        childName: profile.person.name,
        activeChildrenCount: activeCount,
        currentAmount: subscription?.amount ?? null,
        recalculatedAmount: calculateDugsiRate(afterWithdrawalCount),
        isLastActiveChild: afterWithdrawalCount === 0,
        hasActiveSubscription:
          !!subscription &&
          (subscription.status === 'active' ||
            subscription.status === 'paused'),
        isPaused: subscription?.status === 'paused',
      }
    }
  )
}

export async function getWithdrawFamilyPreview(
  familyReferenceId: string
): Promise<WithdrawFamilyPreviewResult> {
  const activeProfiles = await prisma.programProfile.findMany({
    where: {
      familyReferenceId,
      program: DUGSI_PROGRAM,
      status: { in: ['REGISTERED', 'ENROLLED'] },
    },
    include: { person: { select: { name: true } } },
  })

  return {
    count: activeProfiles.length,
    students: activeProfiles.map((p) => ({ id: p.id, name: p.person.name })),
  }
}
