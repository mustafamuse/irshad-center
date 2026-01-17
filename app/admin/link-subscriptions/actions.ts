'use server'

import { revalidatePath } from 'next/cache'

import { createActionLogger } from '@/lib/logger'
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

const logger = createActionLogger('link-subscriptions')

export type { OrphanedSubscription, StudentMatch }

/**
 * Result type for orphaned subscriptions with error handling
 */
export interface OrphanedSubscriptionsResult {
  data: OrphanedSubscription[]
  error?: string
}

/**
 * Get all orphaned subscriptions (subscriptions in Stripe not linked to any student).
 * Combines results from both Mahad and Dugsi programs.
 * Returns an error message if Stripe is not configured.
 */
export async function getOrphanedSubscriptions(): Promise<OrphanedSubscriptionsResult> {
  try {
    const data = await getAllOrphanedSubscriptions()
    return { data }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    logger.error({ err: error }, 'Error fetching orphaned subscriptions')
    return { data: [], error: message }
  }
}

/**
 * Search for students by name, email, or ID.
 */
export async function searchStudents(
  query: string,
  program?: 'MAHAD' | 'DUGSI'
): Promise<
  { success: true; data: StudentMatch[] } | { success: false; error: string }
> {
  try {
    const data = await searchStudentsForLinking(query, program)
    return { success: true, data }
  } catch (error) {
    logger.error({ err: error, query, program }, 'Error searching students')
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to search students',
    }
  }
}

/**
 * Get potential student matches for a subscription based on email.
 */
export async function getPotentialMatches(
  email: string | null,
  program: 'MAHAD' | 'DUGSI'
): Promise<
  { success: true; data: StudentMatch[] } | { success: false; error: string }
> {
  try {
    const data = await getPotentialStudentMatches(email, program)
    return { success: true, data }
  } catch (error) {
    logger.error(
      { err: error, email, program },
      'Error getting potential matches'
    )
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to get potential matches',
    }
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
  const result = await linkSubscriptionToProfile(
    subscriptionId,
    studentId,
    program
  )

  if (result.success) {
    revalidatePath('/admin/link-subscriptions')
  }

  return result
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
  const result = await ignoreSubscriptionService(
    subscriptionId,
    program,
    reason
  )

  if (result.success) {
    revalidatePath('/admin/link-subscriptions')
  }

  return result
}

/**
 * Unignore a subscription, making it appear in the orphaned list again.
 */
export async function unignoreSubscription(
  subscriptionId: string,
  program: 'MAHAD' | 'DUGSI'
): Promise<{ success: boolean; error?: string }> {
  const result = await unignoreSubscriptionService(subscriptionId, program)

  if (result.success) {
    revalidatePath('/admin/link-subscriptions')
  }

  return result
}
