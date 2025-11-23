/**
 * Shared Enrollment Service
 *
 * Cross-program enrollment status management for both Dugsi and Mahad.
 * Handles enrollment lifecycle operations that are common across programs.
 *
 * This service is program-agnostic - it works with any program type.
 *
 * Responsibilities:
 * - Manage enrollment status updates linked to subscription changes
 * - Handle enrollment withdrawals on subscription cancellation
 * - Provide consistent enrollment status management
 */

import * as Sentry from '@sentry/nextjs'

import { prisma } from '@/lib/db'
import { getSubscriptionAssignments } from '@/lib/services/webhooks/webhook-service'
import {
  getActiveEnrollment,
  updateEnrollmentStatus,
} from '@/lib/db/queries/enrollment'

/**
 * Result of enrollment status updates
 */
export interface EnrollmentUpdateResult {
  withdrawn: number
  errors: Array<{ profileId: string; error: string }>
}

/**
 * Handle enrollment status updates when a subscription is canceled.
 *
 * Called by webhook handlers when customer.subscription.deleted event is received.
 * Updates all active enrollments linked to the subscription to WITHDRAWN status.
 *
 * This function should be called BEFORE the subscription is deleted to ensure
 * we can retrieve the billing assignments.
 *
 * @param stripeSubscriptionId - Stripe subscription ID
 * @param reason - Reason for withdrawal (default: 'Subscription canceled')
 * @returns Result with count of withdrawn enrollments and any errors
 */
export async function handleSubscriptionCancellationEnrollments(
  stripeSubscriptionId: string,
  reason: string = 'Subscription canceled'
): Promise<EnrollmentUpdateResult> {
  const results: EnrollmentUpdateResult = {
    withdrawn: 0,
    errors: [],
  }

  // Get all billing assignments for this subscription
  const assignments = await getSubscriptionAssignments(stripeSubscriptionId)

  // Update enrollment status for each active assignment
  for (const assignment of assignments) {
    if (assignment.isActive) {
      try {
        // Find active enrollment for this profile using existing query
        const activeEnrollment = await getActiveEnrollment(
          assignment.programProfileId
        )

        if (activeEnrollment) {
          await updateEnrollmentStatus(
            activeEnrollment.id,
            'WITHDRAWN',
            reason,
            new Date()
          )
          results.withdrawn++
        }
      } catch (error) {
        results.errors.push({
          profileId: assignment.programProfileId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }

  return results
}
