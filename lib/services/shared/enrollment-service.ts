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

import { prisma } from '@/lib/db'
import {
  getBillingAssignmentsBySubscription,
  getSubscriptionByStripeId,
} from '@/lib/db/queries/billing'
import {
  getActiveEnrollment,
  updateEnrollmentStatus,
} from '@/lib/db/queries/enrollment'
import type { DatabaseClient } from '@/lib/db/types'
import { logger } from '@/lib/logger'
import { isValidStatusTransition } from '@/lib/types/enrollment'

/**
 * Result of enrollment status updates
 */
export interface EnrollmentUpdateResult {
  withdrawn: number
  profilesWithdrawn: number
}

/**
 * Handle enrollment status updates when a subscription is canceled.
 *
 * Called by webhook handlers when customer.subscription.deleted event is received.
 * For every still-active BillingAssignment on the canceled subscription:
 *   - sets the active Enrollment row to WITHDRAWN (both programs)
 *   - sets the ProgramProfile.status to WITHDRAWN (Dugsi only)
 *
 * Mahad keeps profile-level status untouched because students move between
 * cohorts; cohort lifecycle is tracked at the Enrollment row level. Dugsi
 * profiles map 1:1 to a single Enrollment, so the profile status is the
 * meaningful "is this kid currently enrolled" signal.
 *
 * MUST be called BEFORE `unlinkSubscription` deactivates the assignments,
 * otherwise the `assignment.isActive` guard skips every row.
 */
export async function handleSubscriptionCancellationEnrollments(
  stripeSubscriptionId: string,
  reason: string = 'Subscription canceled',
  client: DatabaseClient = prisma
): Promise<EnrollmentUpdateResult> {
  async function withdrawEnrollments(
    tx: DatabaseClient
  ): Promise<EnrollmentUpdateResult> {
    const dbSubscription = await getSubscriptionByStripeId(
      stripeSubscriptionId,
      tx
    )
    const assignments = dbSubscription
      ? await getBillingAssignmentsBySubscription(dbSubscription.id, tx)
      : []

    const results: EnrollmentUpdateResult = {
      withdrawn: 0,
      profilesWithdrawn: 0,
    }

    // No per-iteration try/catch: any failure must propagate so the outer
    // $transaction rolls back. PostgreSQL aborts the txn on the first failed
    // statement; subsequent loop writes would silently no-op while we'd
    // still report partial success. Stripe retries the webhook on a thrown
    // error, and the cascade is idempotent (status-already-WITHDRAWN skip
    // + getActiveEnrollment returning null on second run).
    for (const assignment of assignments) {
      if (!assignment.isActive) continue

      const activeEnrollment = await getActiveEnrollment(
        assignment.programProfileId,
        tx
      )

      if (
        activeEnrollment &&
        isValidStatusTransition(activeEnrollment.status, 'WITHDRAWN')
      ) {
        await updateEnrollmentStatus(
          activeEnrollment.id,
          'WITHDRAWN',
          reason,
          new Date(),
          tx
        )
        results.withdrawn++
      }

      // ProgramProfile.program is the canonical program enum on the profile
      // row itself (NOT derived from StripeAccountType). Safe to switch on
      // because the BillingAssignment join guarantees this is the same
      // profile we are about to mark withdrawn.
      if (
        assignment.programProfile.program === 'DUGSI_PROGRAM' &&
        assignment.programProfile.status !== 'WITHDRAWN'
      ) {
        await tx.programProfile.update({
          where: { id: assignment.programProfileId },
          data: { status: 'WITHDRAWN' },
        })
        results.profilesWithdrawn++
      }
    }

    logger.info(
      {
        stripeSubscriptionId,
        withdrawn: results.withdrawn,
        profilesWithdrawn: results.profilesWithdrawn,
      },
      'Subscription cancellation cascade complete'
    )

    return results
  }

  if (client !== prisma) {
    return withdrawEnrollments(client)
  }

  return prisma.$transaction(withdrawEnrollments)
}
