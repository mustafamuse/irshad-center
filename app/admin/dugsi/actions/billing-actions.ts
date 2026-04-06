'use server'

import { revalidatePath } from 'next/cache'

import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { createServiceLogger, logError } from '@/lib/logger'
import { adminActionClient } from '@/lib/safe-action'
import {
  pauseFamilyBilling as pauseFamilyBillingService,
  resumeFamilyBilling as resumeFamilyBillingService,
} from '@/lib/services/dugsi'
import {
  PauseFamilyBillingSchema,
  ResumeFamilyBillingSchema,
} from '@/lib/validations/dugsi'

const logger = createServiceLogger('dugsi-billing-actions')

const _pauseFamilyBillingAction = adminActionClient
  .metadata({ actionName: 'pauseFamilyBillingAction' })
  .inputSchema(PauseFamilyBillingSchema)
  .action(async ({ parsedInput }) => {
    const { familyReferenceId } = parsedInput
    try {
      const result = await pauseFamilyBillingService(familyReferenceId)
      revalidatePath('/admin/dugsi')
      return {
        message: 'Billing paused successfully',
        warning: result.error
          ? `Billing paused in Stripe but DB sync failed: ${result.error}`
          : undefined,
      }
    } catch (error) {
      if (error instanceof ActionError) throw error
      await logError(logger, error, 'Failed to pause billing', {
        familyReferenceId,
      })
      throw new ActionError(
        error instanceof Error ? error.message : 'Failed to pause billing',
        ERROR_CODES.SERVER_ERROR
      )
    }
  })

export async function pauseFamilyBillingAction(
  ...args: Parameters<typeof _pauseFamilyBillingAction>
) {
  return _pauseFamilyBillingAction(...args)
}

const _resumeFamilyBillingAction = adminActionClient
  .metadata({ actionName: 'resumeFamilyBillingAction' })
  .inputSchema(ResumeFamilyBillingSchema)
  .action(async ({ parsedInput }) => {
    const { familyReferenceId } = parsedInput
    try {
      const result = await resumeFamilyBillingService(familyReferenceId)
      revalidatePath('/admin/dugsi')
      return {
        message: 'Billing resumed successfully',
        warning: result.error
          ? `Billing resumed in Stripe but DB sync failed: ${result.error}`
          : undefined,
      }
    } catch (error) {
      if (error instanceof ActionError) throw error
      await logError(logger, error, 'Failed to resume billing', {
        familyReferenceId,
      })
      throw new ActionError(
        error instanceof Error ? error.message : 'Failed to resume billing',
        ERROR_CODES.SERVER_ERROR
      )
    }
  })

export async function resumeFamilyBillingAction(
  ...args: Parameters<typeof _resumeFamilyBillingAction>
) {
  return _resumeFamilyBillingAction(...args)
}
