'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { after } from 'next/server'

import { z } from 'zod'

import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { createServiceLogger, logInfo } from '@/lib/logger'
import { adminActionClient } from '@/lib/safe-action'
import {
  validateDugsiSubscription as validateDugsiSubscriptionService,
  linkDugsiSubscription as linkDugsiSubscriptionService,
  previewStripeSubscription as previewStripeSubscriptionService,
  consolidateStripeSubscription as consolidateStripeSubscriptionService,
  type StripeSubscriptionPreview,
  type ConsolidateSubscriptionResult,
} from '@/lib/services/dugsi'

import {
  previewSubscriptionInputSchema,
  consolidateSubscriptionInputSchema,
} from '../_schemas/dialog-schemas'
import { SubscriptionValidationData, SubscriptionLinkData } from '../_types'

const logger = createServiceLogger('dugsi-admin-actions')

const SubscriptionIdSchema = z.object({ subscriptionId: z.string().min(1) })

const LinkSubscriptionSchema = z.object({
  parentEmail: z.string().email(),
  subscriptionId: z.string().min(1),
})

const _validateDugsiSubscription = adminActionClient
  .metadata({ actionName: 'validateDugsiSubscription' })
  .schema(SubscriptionIdSchema)
  .action(async ({ parsedInput }): Promise<SubscriptionValidationData> => {
    return await validateDugsiSubscriptionService(parsedInput.subscriptionId)
  })

const _linkDugsiSubscription = adminActionClient
  .metadata({ actionName: 'linkDugsiSubscription' })
  .schema(LinkSubscriptionSchema)
  .action(
    async ({
      parsedInput,
    }): Promise<SubscriptionLinkData & { message: string }> => {
      const { parentEmail, subscriptionId } = parsedInput

      if (!parentEmail || parentEmail.trim() === '') {
        throw new ActionError(
          'Parent email is required to link subscription.',
          ERROR_CODES.VALIDATION_ERROR
        )
      }

      const result = await linkDugsiSubscriptionService(
        parentEmail,
        subscriptionId
      )
      after(() => {
        revalidatePath('/admin/dugsi')
        revalidateTag('dugsi-registrations')
      })

      await logInfo(logger, 'Dugsi subscription linked', {
        parentEmail,
        subscriptionId,
        studentsUpdated: result.updated,
      })

      return {
        ...result,
        message: `Successfully linked subscription to ${result.updated} students`,
      }
    }
  )

const _previewStripeSubscriptionForConsolidation = adminActionClient
  .metadata({ actionName: 'previewStripeSubscriptionForConsolidation' })
  .schema(previewSubscriptionInputSchema)
  .action(async ({ parsedInput }): Promise<StripeSubscriptionPreview> => {
    return await previewStripeSubscriptionService(
      parsedInput.subscriptionId,
      parsedInput.familyId
    )
  })

const _consolidateDugsiSubscription = adminActionClient
  .metadata({ actionName: 'consolidateDugsiSubscription' })
  .schema(consolidateSubscriptionInputSchema)
  .action(
    async ({
      parsedInput,
    }): Promise<ConsolidateSubscriptionResult & { message: string }> => {
      const result = await consolidateStripeSubscriptionService(parsedInput)
      after(() => {
        revalidatePath('/admin/dugsi')
        revalidateTag('dugsi-registrations')
      })

      await logInfo(logger, 'Dugsi subscription consolidated', {
        subscriptionId: parsedInput.stripeSubscriptionId,
        familyId: parsedInput.familyId,
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

      return { ...result, message: parts.join(', ') }
    }
  )

export async function validateDugsiSubscription(
  ...args: Parameters<typeof _validateDugsiSubscription>
) {
  return _validateDugsiSubscription(...args)
}
export async function linkDugsiSubscription(
  ...args: Parameters<typeof _linkDugsiSubscription>
) {
  return _linkDugsiSubscription(...args)
}
export async function previewStripeSubscriptionForConsolidation(
  ...args: Parameters<typeof _previewStripeSubscriptionForConsolidation>
) {
  return _previewStripeSubscriptionForConsolidation(...args)
}
export async function consolidateDugsiSubscription(
  ...args: Parameters<typeof _consolidateDugsiSubscription>
) {
  return _consolidateDugsiSubscription(...args)
}
