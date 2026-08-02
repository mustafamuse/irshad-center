'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { after } from 'next/server'

import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { createServiceLogger, logError } from '@/lib/logger'
import { rateLimitedAdminActionClient } from '@/lib/safe-action'
import { getWithdrawalPreview } from '@/lib/services/dugsi/withdrawal-preview-service'
import { withdrawChildren } from '@/lib/services/dugsi/withdrawal-service'
import {
  WithdrawChildrenSchema,
  WithdrawalPreviewSchema,
} from '@/lib/validations/dugsi'

const logger = createServiceLogger('dugsi-withdrawal-actions')

const _getWithdrawalPreviewAction = rateLimitedAdminActionClient
  .metadata({ actionName: 'getWithdrawalPreviewAction', maxAttempts: 30 })
  .schema(WithdrawalPreviewSchema)
  .action(async ({ parsedInput }) => {
    const { familyReferenceId, profileIds } = parsedInput
    try {
      return await getWithdrawalPreview(familyReferenceId, profileIds)
    } catch (error) {
      if (error instanceof ActionError) throw error
      await logError(logger, error, 'Failed to get withdrawal preview', {
        familyReferenceId,
        profileIds,
      })
      throw new ActionError(
        'Failed to get withdrawal preview',
        ERROR_CODES.SERVER_ERROR,
        undefined,
        500
      )
    }
  })

export async function getWithdrawalPreviewAction(
  ...args: Parameters<typeof _getWithdrawalPreviewAction>
) {
  return _getWithdrawalPreviewAction(...args)
}

const _withdrawChildrenAction = rateLimitedAdminActionClient
  .metadata({ actionName: 'withdrawChildrenAction', maxAttempts: 10 })
  .schema(WithdrawChildrenSchema)
  .action(async ({ parsedInput }) => {
    const { familyReferenceId, profileIds } = parsedInput
    try {
      const result = await withdrawChildren(familyReferenceId, profileIds)

      after(() => {
        revalidatePath('/admin/dugsi')
        revalidateTag('dugsi-registrations')
      })

      return {
        ...result,
        message: result.success
          ? `${result.withdrawnCount} ${result.withdrawnCount === 1 ? 'child' : 'children'} withdrawn`
          : undefined,
      }
    } catch (error) {
      if (error instanceof ActionError) throw error
      await logError(logger, error, 'Failed to withdraw children', {
        familyReferenceId,
        profileIds,
      })
      throw new ActionError(
        'Failed to withdraw children',
        ERROR_CODES.SERVER_ERROR,
        undefined,
        500
      )
    }
  })

export async function withdrawChildrenAction(
  ...args: Parameters<typeof _withdrawChildrenAction>
) {
  return _withdrawChildrenAction(...args)
}
