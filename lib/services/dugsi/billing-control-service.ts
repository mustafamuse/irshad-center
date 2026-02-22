import * as Sentry from '@sentry/nextjs'

import { prisma } from '@/lib/db'
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { createServiceLogger, logError, logInfo } from '@/lib/logger'
import { getDugsiStripeClient } from '@/lib/stripe-dugsi'

import { findFamilySubscription } from './billing-helpers'

const logger = createServiceLogger('dugsi-billing-control')

export interface BillingControlResult {
  success: boolean
  error?: string
}

const BILLING_TOGGLE_CONFIG = {
  pause: {
    requiredStatus: 'active' as const,
    noSubError: 'No active subscription found for this family',
    statusError: (s: string) => `Cannot pause subscription with status "${s}"`,
    stripePayload: { pause_collection: { behavior: 'void' as const } },
    dbStatus: 'paused' as const,
    criticalMsg:
      'CRITICAL: Stripe paused but DB update failed - states diverged',
    successMsg: 'Family billing paused',
    spanName: 'withdrawal.pauseFamilyBilling',
  },
  resume: {
    requiredStatus: 'paused' as const,
    noSubError: 'No subscription found for this family',
    statusError: (s: string) => `Cannot resume subscription with status "${s}"`,
    stripePayload: { pause_collection: null },
    dbStatus: 'active' as const,
    criticalMsg:
      'CRITICAL: Stripe resumed but DB update failed - states diverged',
    successMsg: 'Family billing resumed',
    spanName: 'withdrawal.resumeFamilyBilling',
  },
} as const

async function toggleFamilyBillingStatus(
  familyReferenceId: string,
  action: 'pause' | 'resume'
): Promise<BillingControlResult> {
  const config = BILLING_TOGGLE_CONFIG[action]

  return Sentry.startSpan(
    { name: config.spanName, op: 'function' },
    async () => {
      const subscription = await findFamilySubscription(familyReferenceId)

      if (!subscription) {
        throw new ActionError(
          config.noSubError,
          ERROR_CODES.NO_ACTIVE_SUBSCRIPTION
        )
      }

      if (subscription.status !== config.requiredStatus) {
        throw new ActionError(
          config.statusError(subscription.status),
          ERROR_CODES.INVALID_INPUT
        )
      }

      const stripe = getDugsiStripeClient()

      await stripe.subscriptions.update(
        subscription.stripeSubscriptionId,
        config.stripePayload
      )

      try {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: config.dbStatus },
        })
      } catch (dbError) {
        await logError(logger, dbError, config.criticalMsg, {
          familyReferenceId,
          stripeSubscriptionId: subscription.stripeSubscriptionId,
          intendedStatus: config.dbStatus,
        })
        return {
          success: false,
          error: `Stripe ${action}d but DB update failed: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`,
        }
      }

      await logInfo(logger, config.successMsg, {
        familyReferenceId,
        subscriptionId: subscription.stripeSubscriptionId,
      })

      return { success: true }
    }
  )
}

export async function pauseFamilyBilling(
  familyReferenceId: string
): Promise<BillingControlResult> {
  return toggleFamilyBillingStatus(familyReferenceId, 'pause')
}

export async function resumeFamilyBilling(
  familyReferenceId: string
): Promise<BillingControlResult> {
  return toggleFamilyBillingStatus(familyReferenceId, 'resume')
}
