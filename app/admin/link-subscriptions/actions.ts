'use server'

import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache'

import { z } from 'zod'

import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { createActionLogger, logInfo } from '@/lib/logger'
import { adminActionClient } from '@/lib/safe-action'
import {
  getAllOrphanedSubscriptions,
  searchStudentsForLinking,
  getPotentialStudentMatches,
  linkSubscriptionToProfile,
  ignoreSubscription as ignoreSubscriptionService,
  unignoreSubscription as unignoreSubscriptionService,
  type OrphanedSubscription,
  type StudentMatch,
} from '@/lib/services/link-subscriptions'

export type { OrphanedSubscription, StudentMatch }

export interface OrphanedSubscriptionsResult {
  data: OrphanedSubscription[]
  error?: string
}

const logger = createActionLogger('link-subscriptions')

const programSchema = z.enum(['MAHAD', 'DUGSI'])

const getCachedOrphanedSubscriptions = unstable_cache(
  async () => getAllOrphanedSubscriptions(),
  ['orphaned-subscriptions'],
  { revalidate: 300, tags: ['link-subscriptions'] }
)

const _getOrphanedSubscriptions = adminActionClient
  .metadata({ actionName: 'getOrphanedSubscriptions' })
  .action(async () => {
    const raw = await getCachedOrphanedSubscriptions()
    return raw.map((sub) => ({
      ...sub,
      created: new Date(sub.created),
      currentPeriodStart: sub.currentPeriodStart
        ? new Date(sub.currentPeriodStart)
        : null,
      currentPeriodEnd: sub.currentPeriodEnd
        ? new Date(sub.currentPeriodEnd)
        : null,
    }))
  })

const searchStudentsSchema = z.object({
  query: z.string(),
  program: programSchema.optional(),
})

const _searchStudents = adminActionClient
  .metadata({ actionName: 'searchStudents' })
  .schema(searchStudentsSchema)
  .action(async ({ parsedInput }) => {
    return await searchStudentsForLinking(
      parsedInput.query,
      parsedInput.program
    )
  })

const getPotentialMatchesSchema = z.object({
  email: z.string().nullable(),
  program: programSchema,
})

const _getPotentialMatches = adminActionClient
  .metadata({ actionName: 'getPotentialMatches' })
  .schema(getPotentialMatchesSchema)
  .action(async ({ parsedInput }) => {
    return await getPotentialStudentMatches(
      parsedInput.email,
      parsedInput.program
    )
  })

const linkSubscriptionToStudentSchema = z.object({
  subscriptionId: z.string(),
  studentId: z.string(),
  program: programSchema,
})

const _linkSubscriptionToStudent = adminActionClient
  .metadata({ actionName: 'linkSubscriptionToStudent' })
  .schema(linkSubscriptionToStudentSchema)
  .action(async ({ parsedInput }) => {
    const { subscriptionId, studentId, program } = parsedInput
    const result = await linkSubscriptionToProfile(
      subscriptionId,
      studentId,
      program
    )

    if (!result.success) {
      throw new ActionError(
        result.error || 'Failed to link subscription',
        ERROR_CODES.SERVER_ERROR
      )
    }

    await logInfo(logger, 'Subscription linked to student', {
      subscriptionId,
      studentId,
      program,
    })
    revalidateTag('link-subscriptions')
    revalidatePath('/admin/link-subscriptions')
    return { linked: true }
  })

const ignoreSubscriptionSchema = z.object({
  subscriptionId: z.string(),
  program: programSchema,
  reason: z.string().optional(),
})

const _ignoreSubscription = adminActionClient
  .metadata({ actionName: 'ignoreSubscription' })
  .schema(ignoreSubscriptionSchema)
  .action(async ({ parsedInput }) => {
    const { subscriptionId, program, reason } = parsedInput
    const result = await ignoreSubscriptionService(
      subscriptionId,
      program,
      reason
    )

    if (!result.success) {
      throw new ActionError(
        result.error || 'Failed to ignore subscription',
        ERROR_CODES.SERVER_ERROR
      )
    }

    await logInfo(logger, 'Subscription ignored', {
      subscriptionId,
      program,
      reason,
    })
    revalidateTag('link-subscriptions')
    revalidatePath('/admin/link-subscriptions')
  })

const unignoreSubscriptionSchema = z.object({
  subscriptionId: z.string(),
  program: programSchema,
})

const _unignoreSubscription = adminActionClient
  .metadata({ actionName: 'unignoreSubscription' })
  .schema(unignoreSubscriptionSchema)
  .action(async ({ parsedInput }) => {
    const { subscriptionId, program } = parsedInput
    const result = await unignoreSubscriptionService(subscriptionId, program)

    if (!result.success) {
      throw new ActionError(
        result.error || 'Failed to unignore subscription',
        ERROR_CODES.SERVER_ERROR
      )
    }

    await logInfo(logger, 'Subscription unignored', { subscriptionId, program })
    revalidateTag('link-subscriptions')
    revalidatePath('/admin/link-subscriptions')
  })

export async function getOrphanedSubscriptions(
  ...args: Parameters<typeof _getOrphanedSubscriptions>
) {
  return _getOrphanedSubscriptions(...args)
}
export async function searchStudents(
  ...args: Parameters<typeof _searchStudents>
) {
  return _searchStudents(...args)
}
export async function getPotentialMatches(
  ...args: Parameters<typeof _getPotentialMatches>
) {
  return _getPotentialMatches(...args)
}
export async function linkSubscriptionToStudent(
  ...args: Parameters<typeof _linkSubscriptionToStudent>
) {
  return _linkSubscriptionToStudent(...args)
}
export async function ignoreSubscription(
  ...args: Parameters<typeof _ignoreSubscription>
) {
  return _ignoreSubscription(...args)
}
export async function unignoreSubscription(
  ...args: Parameters<typeof _unignoreSubscription>
) {
  return _unignoreSubscription(...args)
}
