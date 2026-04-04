'use server'

import { createZakatFitrCheckoutSession } from '@/lib/services/donation/zakat-fitr-checkout-service'
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { rateLimitedActionClient } from '@/lib/safe-action'
import { ZakatFitrCheckoutSchema } from '@/lib/validations/zakat-fitr'

const _createZakatFitrAction = rateLimitedActionClient
  .metadata({ actionName: 'createZakatFitrAction' })
  .schema(ZakatFitrCheckoutSchema)
  .action(async ({ parsedInput }) => {
    const session = await createZakatFitrCheckoutSession(parsedInput)
    if (!session.url) {
      throw new ActionError(
        'Failed to create checkout session',
        ERROR_CODES.SERVER_ERROR
      )
    }
    return { url: session.url }
  })

export async function createZakatFitrAction(
  ...args: Parameters<typeof _createZakatFitrAction>
) {
  return _createZakatFitrAction(...args)
}
