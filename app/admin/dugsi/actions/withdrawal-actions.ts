'use server'

import { revalidatePath } from 'next/cache'

import { ActionError } from '@/lib/errors/action-error'
import { createServiceLogger, logError } from '@/lib/logger'
import {
  withdrawChild as withdrawChildService,
  withdrawFamily as withdrawFamilyService,
  getWithdrawFamilyPreview as getWithdrawFamilyPreviewService,
  reEnrollChild as reEnrollChildService,
  getWithdrawPreview as getWithdrawPreviewService,
  pauseFamilyBilling as pauseFamilyBillingService,
  resumeFamilyBilling as resumeFamilyBillingService,
  type WithdrawPreview,
  type WithdrawResult,
  type ReEnrollResult,
} from '@/lib/services/dugsi'
import {
  WithdrawChildSchema,
  WithdrawFamilySchema,
  ReEnrollChildSchema,
  GetWithdrawPreviewSchema,
  GetWithdrawFamilyPreviewSchema,
  PauseFamilyBillingSchema,
  ResumeFamilyBillingSchema,
} from '@/lib/validations/dugsi'

import type { ActionResult } from '../_types'

const logger = createServiceLogger('dugsi-withdrawal-actions')

export async function getWithdrawChildPreviewAction(
  rawInput: unknown
): Promise<ActionResult<WithdrawPreview>> {
  const parsed = GetWithdrawPreviewSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message || 'Invalid input',
    }
  }

  const { studentId } = parsed.data
  try {
    const preview = await getWithdrawPreviewService(studentId)
    return { success: true, data: preview }
  } catch (error) {
    await logError(logger, error, 'Failed to get withdraw preview', {
      studentId,
    })
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to get withdraw preview',
    }
  }
}

export async function withdrawChildAction(
  rawInput: unknown
): Promise<ActionResult<WithdrawResult>> {
  const parsed = WithdrawChildSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message || 'Invalid input',
    }
  }

  try {
    const result = await withdrawChildService(parsed.data)
    revalidatePath('/admin/dugsi')

    return {
      success: true,
      data: result,
      message: 'Child withdrawn successfully',
      warning: result.billingError
        ? `Child withdrawn but billing update failed: ${result.billingError}`
        : undefined,
    }
  } catch (error) {
    if (error instanceof ActionError) {
      return { success: false, error: error.message }
    }
    await logError(logger, error, 'Failed to withdraw child', {
      studentId: parsed.data.studentId,
    })
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to withdraw child',
    }
  }
}

export async function reEnrollChildAction(
  rawInput: unknown
): Promise<ActionResult<ReEnrollResult>> {
  const parsed = ReEnrollChildSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message || 'Invalid input',
    }
  }

  try {
    const result = await reEnrollChildService(parsed.data)
    revalidatePath('/admin/dugsi')

    return {
      success: true,
      data: result,
      message: 'Child re-enrolled successfully',
      warning: result.billingError
        ? `Child re-enrolled but billing update failed: ${result.billingError}`
        : undefined,
    }
  } catch (error) {
    if (error instanceof ActionError) {
      return { success: false, error: error.message }
    }
    await logError(logger, error, 'Failed to re-enroll child', {
      studentId: parsed.data.studentId,
    })
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to re-enroll child',
    }
  }
}

export async function pauseFamilyBillingAction(
  rawInput: unknown
): Promise<ActionResult> {
  const parsed = PauseFamilyBillingSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message || 'Invalid input',
    }
  }

  try {
    const result = await pauseFamilyBillingService(
      parsed.data.familyReferenceId
    )
    revalidatePath('/admin/dugsi')

    return {
      success: true,
      message: 'Billing paused successfully',
      warning: result.error
        ? `Billing paused in Stripe but DB sync failed: ${result.error}`
        : undefined,
    }
  } catch (error) {
    if (error instanceof ActionError) {
      return { success: false, error: error.message }
    }
    await logError(logger, error, 'Failed to pause billing', {
      familyReferenceId: parsed.data.familyReferenceId,
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to pause billing',
    }
  }
}

export async function resumeFamilyBillingAction(
  rawInput: unknown
): Promise<ActionResult> {
  const parsed = ResumeFamilyBillingSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message || 'Invalid input',
    }
  }

  try {
    const result = await resumeFamilyBillingService(
      parsed.data.familyReferenceId
    )
    revalidatePath('/admin/dugsi')

    return {
      success: true,
      message: 'Billing resumed successfully',
      warning: result.error
        ? `Billing resumed in Stripe but DB sync failed: ${result.error}`
        : undefined,
    }
  } catch (error) {
    if (error instanceof ActionError) {
      return { success: false, error: error.message }
    }
    await logError(logger, error, 'Failed to resume billing', {
      familyReferenceId: parsed.data.familyReferenceId,
    })
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to resume billing',
    }
  }
}

export async function getWithdrawFamilyPreviewAction(
  rawInput: unknown
): Promise<
  ActionResult<{
    count: number
    students: Array<{ id: string; name: string }>
  }>
> {
  const parsed = GetWithdrawFamilyPreviewSchema.safeParse(rawInput)

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message || 'Invalid input',
    }
  }

  try {
    const preview = await getWithdrawFamilyPreviewService(
      parsed.data.familyReferenceId
    )
    return { success: true, data: preview }
  } catch (error) {
    await logError(logger, error, 'Failed to get withdraw family preview', {
      familyReferenceId: parsed.data.familyReferenceId,
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load preview',
    }
  }
}

export async function withdrawAllFamilyChildrenAction(
  rawInput: unknown
): Promise<ActionResult<{ withdrawnCount: number }>> {
  const parsed = WithdrawFamilySchema.safeParse(rawInput)

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message || 'Invalid input',
    }
  }

  try {
    const result = await withdrawFamilyService(parsed.data)

    revalidatePath('/admin/dugsi')

    return {
      success: true,
      data: { withdrawnCount: result.withdrawnCount },
      message: `${result.withdrawnCount} child(ren) withdrawn`,
      warning: result.billingError
        ? `${result.withdrawnCount} child(ren) withdrawn but billing update failed: ${result.billingError}`
        : undefined,
    }
  } catch (error) {
    if (error instanceof ActionError) {
      return { success: false, error: error.message }
    }
    await logError(logger, error, 'Failed to withdraw all family children', {
      familyReferenceId: parsed.data.familyReferenceId,
    })
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to withdraw all children',
    }
  }
}
