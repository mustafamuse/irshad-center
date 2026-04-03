'use server'

import { createDonationCheckoutSession } from '@/lib/services/donation/checkout-service'
import { createActionLogger, logError } from '@/lib/logger'
import { type ActionResult } from '@/lib/utils/action-helpers'
import {
  DonationCheckoutSchema,
  type DonationCheckoutInput,
} from '@/lib/validations/donation'

const logger = createActionLogger('donate-actions')

export async function createDonationAction(
  formData: DonationCheckoutInput
): Promise<ActionResult<{ url: string }>> {
  try {
    const validated = DonationCheckoutSchema.parse(formData)
    const session = await createDonationCheckoutSession(validated)

    if (!session.url) {
      throw new Error('Failed to create checkout session')
    }

    return { success: true, data: { url: session.url } }
  } catch (error) {
    await logError(logger, error, 'Failed to create donation checkout')
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to create donation checkout',
    }
  }
}
