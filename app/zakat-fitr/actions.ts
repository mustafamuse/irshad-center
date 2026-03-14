'use server'

import { createZakatFitrCheckoutSession } from '@/lib/services/donation/zakat-fitr-checkout-service'
import { type ActionResult, withActionError } from '@/lib/utils/action-helpers'
import {
  ZakatFitrCheckoutSchema,
  type ZakatFitrCheckoutInput,
} from '@/lib/validations/zakat-fitr'

export async function createZakatFitrAction(
  formData: ZakatFitrCheckoutInput
): Promise<ActionResult<{ url: string }>> {
  return withActionError(async () => {
    const validated = ZakatFitrCheckoutSchema.parse(formData)
    const session = await createZakatFitrCheckoutSession(validated)

    if (!session.url) {
      throw new Error('Failed to create checkout session')
    }

    return { url: session.url }
  }, 'Failed to create Zakat al-Fitr checkout')
}
