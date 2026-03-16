'use server'

import { revalidatePath } from 'next/cache'

import { ActionError } from '@/lib/errors/action-error'
import { createServiceLogger, logError } from '@/lib/logger'
import {
  pauseFamilyBilling as pauseFamilyBillingService,
  resumeFamilyBilling as resumeFamilyBillingService,
} from '@/lib/services/dugsi'
import {
  PauseFamilyBillingSchema,
  ResumeFamilyBillingSchema,
} from '@/lib/validations/dugsi'

import type { ActionResult } from '../_types'

const logger = createServiceLogger('dugsi-billing-actions')

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
