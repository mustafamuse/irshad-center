'use server'

import { createDonationCheckoutSession } from '@/lib/services/donation/checkout-service'
import { type ActionResult, withActionError } from '@/lib/utils/action-helpers'
import {
  DonationCheckoutSchema,
  type DonationCheckoutInput,
} from '@/lib/validations/donation'

export async function createDonationAction(
  formData: DonationCheckoutInput
): Promise<ActionResult<{ url: string }>> {
  return withActionError(async () => {
    const validated = DonationCheckoutSchema.parse(formData)
    const session = await createDonationCheckoutSession(validated)

    if (!session.url) {
      throw new Error('Failed to create checkout session')
    }

    return { url: session.url }
  }, 'Failed to create donation checkout')
}
