'use server'

/**
 * Link Subscriptions Server Actions
 *
 * Refactored to use subscription linking service for DRY architecture.
 * Handles orphaned subscription discovery and manual linking.
 */

import { revalidatePath } from 'next/cache'

import {
  getAllOrphanedSubscriptions,
  searchStudentsForLinking,
  getPotentialStudentMatches,
  linkSubscriptionToProfile as linkSubscriptionToProfileService,
} from '@/lib/services/link-subscriptions'

// Re-export types from service for backwards compatibility
export type {
  OrphanedSubscription,
  StudentMatch,
} from '@/lib/services/link-subscriptions'

/**
 * Get all orphaned subscriptions (subscriptions in Stripe not linked to any student)
 * Delegates to subscription linking service
 */
export async function getOrphanedSubscriptions() {
  return await getAllOrphanedSubscriptions()
}

/**
 * Search for students by name, email, or ID
 * Delegates to subscription linking service
 */
export async function searchStudents(
  query: string,
  program?: 'MAHAD' | 'DUGSI'
) {
  return await searchStudentsForLinking(query, program)
}

/**
 * Get potential student matches for a subscription based on email
 * Delegates to subscription linking service
 */
export async function getPotentialMatches(
  email: string | null,
  program: 'MAHAD' | 'DUGSI'
) {
  return await getPotentialStudentMatches(email, program)
}

/**
 * Link a subscription to a program profile
 * Delegates to subscription linking service
 */
export async function linkSubscriptionToProfile(
  subscriptionId: string,
  profileId: string,
  program: 'MAHAD' | 'DUGSI'
): Promise<{ success: boolean; error?: string }> {
  const result = await linkSubscriptionToProfileService(
    subscriptionId,
    profileId,
    program
  )

  if (result.success) {
    revalidatePath('/admin/link-subscriptions')
  }

  return result
}

/**
 * Link a subscription to a student (legacy function name for backward compatibility)
 * @deprecated Use linkSubscriptionToProfile instead
 */
export async function linkSubscriptionToStudent(
  subscriptionId: string,
  studentId: string,
  program: 'MAHAD' | 'DUGSI'
): Promise<{ success: boolean; error?: string }> {
  return linkSubscriptionToProfile(subscriptionId, studentId, program)
}
