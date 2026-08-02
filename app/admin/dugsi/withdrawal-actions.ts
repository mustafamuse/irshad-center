'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { after } from 'next/server'

import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { createServiceLogger, logError } from '@/lib/logger'
import { adminActionClient } from '@/lib/safe-action'
import { getWithdrawalPreview } from '@/lib/services/dugsi/withdrawal-preview-service'
import { withdrawChildren } from '@/lib/services/dugsi/withdrawal-service'
import {
  WithdrawChildrenSchema,
  WithdrawalPreviewSchema,
} from '@/lib/validations/dugsi'

const logger = createServiceLogger('dugsi-withdrawal-actions')

const _getWithdrawalPreviewAction = adminActionClient
  .metadata({ actionName: 'getWithdrawalPreviewAction' })
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
        error instanceof Error
          ? error.message
          : 'Failed to get withdrawal preview',
        ERROR_CODES.SERVER_ERROR
      )
    }
  })

export async function getWithdrawalPreviewAction(
  ...args: Parameters<typeof _getWithdrawalPreviewAction>
) {
  return _getWithdrawalPreviewAction(...args)
}

const _withdrawChildrenAction = adminActionClient
  .metadata({ actionName: 'withdrawChildrenAction' })
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
        error instanceof Error ? error.message : 'Failed to withdraw children',
        ERROR_CODES.SERVER_ERROR
      )
    }
  })

export async function withdrawChildrenAction(
  ...args: Parameters<typeof _withdrawChildrenAction>
) {
  return _withdrawChildrenAction(...args)
}
