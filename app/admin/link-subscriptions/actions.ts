'use server'

import { revalidatePath } from 'next/cache'

import {
  getAllOrphanedSubscriptions,
  searchStudentsForLinking,
  getPotentialStudentMatches,
  linkSubscriptionToProfile,
  type OrphanedSubscription,
  type StudentMatch,
} from '@/lib/services/link-subscriptions'

export type { OrphanedSubscription, StudentMatch }

/**
 * Get all orphaned subscriptions (subscriptions in Stripe not linked to any student).
 * Combines results from both Mahad and Dugsi programs.
 */
export async function getOrphanedSubscriptions(): Promise<
  OrphanedSubscription[]
> {
  return await getAllOrphanedSubscriptions()
}

/**
 * Search for students by name, email, or ID.
 */
export async function searchStudents(
  query: string,
  program?: 'MAHAD' | 'DUGSI'
): Promise<StudentMatch[]> {
  return await searchStudentsForLinking(query, program)
}

/**
 * Get potential student matches for a subscription based on email.
 */
export async function getPotentialMatches(
  email: string | null,
  program: 'MAHAD' | 'DUGSI'
): Promise<StudentMatch[]> {
  return await getPotentialStudentMatches(email, program)
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
