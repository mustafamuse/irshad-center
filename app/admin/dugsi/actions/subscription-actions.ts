'use server'

import { revalidatePath } from 'next/cache'

import { ActionError } from '@/lib/errors/action-error'
import { createServiceLogger, logError, logInfo } from '@/lib/logger'
import {
  previewStripeSubscription as previewStripeSubscriptionService,
  consolidateStripeSubscription as consolidateStripeSubscriptionService,
  type StripeSubscriptionPreview,
  type ConsolidateSubscriptionResult,
} from '@/lib/services/dugsi'

import {
  previewSubscriptionInputSchema,
  consolidateSubscriptionInputSchema,
} from '../_schemas/dialog-schemas'
import type { ActionResult } from '../_types'

const logger = createServiceLogger('dugsi-subscription-actions')

export async function previewStripeSubscriptionForConsolidation(
  subscriptionId: string,
  familyId: string
): Promise<ActionResult<StripeSubscriptionPreview>> {
  try {
    const validated = previewSubscriptionInputSchema.parse({
      subscriptionId,
      familyId,
    })

    const preview = await previewStripeSubscriptionService(
      validated.subscriptionId,
      validated.familyId
    )

    return {
      success: true,
      data: preview,
    }
  } catch (error) {
    await logError(
      logger,
      error,
      'Failed to preview subscription for consolidation',
      { subscriptionId, familyId }
    )
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to preview subscription',
    }
  }
}

export async function consolidateDugsiSubscription(input: {
  stripeSubscriptionId: string
  familyId: string
  syncStripeCustomer: boolean
  forceOverride?: boolean
}): Promise<ActionResult<ConsolidateSubscriptionResult>> {
  try {
    const validated = consolidateSubscriptionInputSchema.parse(input)

    const result = await consolidateStripeSubscriptionService(validated)

    revalidatePath('/admin/dugsi')

    await logInfo(logger, 'Dugsi subscription consolidated', {
      subscriptionId: input.stripeSubscriptionId,
      familyId: input.familyId,
      assignmentsCreated: result.assignmentsCreated,
      stripeCustomerSynced: result.stripeCustomerSynced,
      previousFamilyUnlinked: result.previousFamilyUnlinked,
    })

    const parts: string[] = []
    parts.push('Subscription linked')
    if (result.assignmentsCreated > 0) {
      parts.push(
        `${result.assignmentsCreated} ${result.assignmentsCreated === 1 ? 'child' : 'children'} assigned`
      )
    }
    if (result.stripeCustomerSynced) {
      parts.push('Stripe customer synced')
    } else if (result.syncError) {
      parts.push(`Stripe sync failed: ${result.syncError}`)
    }
    if (result.previousFamilyUnlinked) {
      parts.push('moved from previous family')
    }

    return {
      success: true,
      data: result,
      message: parts.join(', '),
    }
  } catch (error) {
    await logError(logger, error, 'Failed to consolidate subscription', {
      subscriptionId: input.stripeSubscriptionId,
      familyId: input.familyId,
    })

    if (error instanceof ActionError && error.code === 'ALREADY_LINKED') {
      return {
        success: false,
        error:
          'This subscription is already linked to another family. Enable "force override" to move it.',
      }
    }

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to consolidate subscription',
    }
  }
}
