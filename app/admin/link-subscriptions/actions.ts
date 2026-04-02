'use server'

import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache'

import { assertAdmin } from '@/lib/auth'
import { ActionError } from '@/lib/errors/action-error'
import { createActionLogger, logError, logInfo } from '@/lib/logger'
import { ActionResult } from '@/lib/utils/action-helpers'
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

const logger = createActionLogger('link-subscriptions')

/**
 * Result type for orphaned subscriptions with error handling
 */
export interface OrphanedSubscriptionsResult {
  data: OrphanedSubscription[]
  error?: string
}

const getCachedOrphanedSubscriptions = unstable_cache(
  async () => getAllOrphanedSubscriptions(),
  ['orphaned-subscriptions'],
  { revalidate: 300, tags: ['link-subscriptions'] }
)

export async function getOrphanedSubscriptions(): Promise<OrphanedSubscriptionsResult> {
  try {
    await assertAdmin('getOrphanedSubscriptions')
    const raw = await getCachedOrphanedSubscriptions()
    const data = raw.map((sub) => ({
      ...sub,
      created: new Date(sub.created),
      currentPeriodStart: sub.currentPeriodStart
        ? new Date(sub.currentPeriodStart)
        : null,
      currentPeriodEnd: sub.currentPeriodEnd
        ? new Date(sub.currentPeriodEnd)
        : null,
    }))
    return { data }
  } catch (error) {
    if (error instanceof ActionError) throw error
    await logError(logger, error, 'Failed to fetch orphaned subscriptions')
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { data: [], error: message }
  }
}

/**
 * Search for students by name, email, or ID.
 */
export async function searchStudents(
  query: string,
  program?: 'MAHAD' | 'DUGSI'
): Promise<ActionResult<StudentMatch[]>> {
  try {
    await assertAdmin('searchStudents')
    const data = await searchStudentsForLinking(query, program)
    return { success: true, data }
  } catch (error) {
    if (error instanceof ActionError) {
      return { success: false, error: error.message }
    }
    await logError(logger, error, 'Failed to search students')
    return { success: false, error: 'Failed to search students' }
  }
}

/**
 * Get potential student matches for a subscription based on email.
 */
export async function getPotentialMatches(
  email: string | null,
  program: 'MAHAD' | 'DUGSI'
): Promise<ActionResult<StudentMatch[]>> {
  try {
    await assertAdmin('getPotentialMatches')
    const data = await getPotentialStudentMatches(email, program)
    return { success: true, data }
  } catch (error) {
    if (error instanceof ActionError) {
      return { success: false, error: error.message }
    }
    await logError(logger, error, 'Failed to get potential matches')
    return { success: false, error: 'Failed to get potential matches' }
  }
}

/**
 * Link a subscription to a student.
 */
export async function linkSubscriptionToStudent(
  subscriptionId: string,
  studentId: string,
  program: 'MAHAD' | 'DUGSI'
): Promise<{ success: boolean; error?: string }> {
  try {
    await assertAdmin('linkSubscriptionToStudent')
    const result = await linkSubscriptionToProfile(
      subscriptionId,
      studentId,
      program
    )

    if (result.success) {
      await logInfo(logger, 'Subscription linked to student', {
        subscriptionId,
        studentId,
        program,
      })
      revalidateTag('link-subscriptions')
      revalidatePath('/admin/link-subscriptions')
    }

    return result
  } catch (error) {
    if (error instanceof ActionError)
      return { success: false, error: error.message }
    await logError(logger, error, 'Failed to link subscription', {
      subscriptionId,
      studentId,
      program,
    })
    return { success: false, error: 'Failed to link subscription' }
  }
}

/**
 * Mark a subscription as ignored.
 * Ignored subscriptions won't appear in the orphaned list.
 */
export async function ignoreSubscription(
  subscriptionId: string,
  program: 'MAHAD' | 'DUGSI',
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await assertAdmin('ignoreSubscription')
    const result = await ignoreSubscriptionService(
      subscriptionId,
      program,
      reason
    )

    if (result.success) {
      await logInfo(logger, 'Subscription ignored', {
        subscriptionId,
        program,
        reason,
      })
      revalidateTag('link-subscriptions')
      revalidatePath('/admin/link-subscriptions')
    }

    return result
  } catch (error) {
    if (error instanceof ActionError)
      return { success: false, error: error.message }
    await logError(logger, error, 'Failed to ignore subscription', {
      subscriptionId,
      program,
    })
    return { success: false, error: 'Failed to ignore subscription' }
  }
}

/**
 * Unignore a subscription, making it appear in the orphaned list again.
 */
export async function unignoreSubscription(
  subscriptionId: string,
  program: 'MAHAD' | 'DUGSI'
): Promise<{ success: boolean; error?: string }> {
  try {
    await assertAdmin('unignoreSubscription')
    const result = await unignoreSubscriptionService(subscriptionId, program)

    if (result.success) {
      await logInfo(logger, 'Subscription unignored', {
        subscriptionId,
        program,
      })
      revalidateTag('link-subscriptions')
      revalidatePath('/admin/link-subscriptions')
    }

    return result
  } catch (error) {
    if (error instanceof ActionError)
      return { success: false, error: error.message }
    await logError(logger, error, 'Failed to unignore subscription', {
      subscriptionId,
      program,
    })
    return { success: false, error: 'Failed to unignore subscription' }
  }
}
