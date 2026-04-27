'use server'

import { revalidatePath } from 'next/cache'

import { createServiceLogger, logError } from '@/lib/logger'
import {
  getWithdrawalPreview,
  type WithdrawalPreview,
} from '@/lib/services/dugsi/withdrawal-preview-service'
import {
  withdrawChildren,
  type WithdrawChildrenResult,
} from '@/lib/services/dugsi/withdrawal-service'
import type { ActionResult } from '@/lib/utils/action-helpers'
import {
  WithdrawChildrenSchema,
  WithdrawalPreviewSchema,
} from '@/lib/validations/dugsi'

const logger = createServiceLogger('dugsi-withdrawal-actions')

export async function getWithdrawalPreviewAction(
  familyReferenceId: string,
  profileIds: string[]
): Promise<ActionResult<WithdrawalPreview>> {
  const validation = WithdrawalPreviewSchema.safeParse({
    familyReferenceId,
    profileIds,
  })
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.errors[0]?.message || 'Invalid input',
    }
  }

  try {
    const preview = await getWithdrawalPreview(
      validation.data.familyReferenceId,
      validation.data.profileIds
    )
    return { success: true, data: preview }
  } catch (error) {
    await logError(logger, error, 'Failed to get withdrawal preview', {
      familyReferenceId,
      profileIds,
    })
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to get withdrawal preview',
    }
  }
}

export async function withdrawChildrenAction(
  familyReferenceId: string,
  profileIds: string[]
): Promise<ActionResult<WithdrawChildrenResult>> {
  const validation = WithdrawChildrenSchema.safeParse({
    familyReferenceId,
    profileIds,
  })
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.errors[0]?.message || 'Invalid input',
    }
  }

  try {
    const result = await withdrawChildren(
      validation.data.familyReferenceId,
      validation.data.profileIds
    )

    revalidatePath('/admin/dugsi')

    return {
      success: result.success,
      data: result,
      error: result.error,
      warning: result.warning,
      message: result.success
        ? `${result.withdrawnCount} ${result.withdrawnCount === 1 ? 'child' : 'children'} withdrawn`
        : undefined,
    }
  } catch (error) {
    await logError(logger, error, 'Failed to withdraw children', {
      familyReferenceId,
      profileIds,
    })
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to withdraw children',
    }
  }
}
