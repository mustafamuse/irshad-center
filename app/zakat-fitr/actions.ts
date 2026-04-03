'use server'

import { createZakatFitrCheckoutSession } from '@/lib/services/donation/zakat-fitr-checkout-service'
import { createActionLogger, logError } from '@/lib/logger'
import { type ActionResult } from '@/lib/utils/action-helpers'
import {
  ZakatFitrCheckoutSchema,
  type ZakatFitrCheckoutInput,
} from '@/lib/validations/zakat-fitr'

const logger = createActionLogger('zakat-fitr-actions')

export async function createZakatFitrAction(
  formData: ZakatFitrCheckoutInput
): Promise<ActionResult<{ url: string }>> {
  try {
    const validated = ZakatFitrCheckoutSchema.parse(formData)
    const session = await createZakatFitrCheckoutSession(validated)

    if (!session.url) {
      throw new Error('Failed to create checkout session')
    }

    return { success: true, data: { url: session.url } }
  } catch (error) {
    await logError(logger, error, 'Failed to create Zakat al-Fitr checkout')
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to create Zakat al-Fitr checkout',
    }
  }
}
