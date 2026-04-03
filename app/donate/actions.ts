'use server'

import { createDonationCheckoutSession } from '@/lib/services/donation/checkout-service'
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { actionClient } from '@/lib/safe-action'
import { DonationCheckoutSchema } from '@/lib/validations/donation'

const _createDonationAction = actionClient
  .metadata({ actionName: 'createDonationAction' })
  .schema(DonationCheckoutSchema)
  .action(async ({ parsedInput }) => {
    const session = await createDonationCheckoutSession(parsedInput)
    if (!session.url) {
      throw new ActionError(
        'Failed to create checkout session',
        ERROR_CODES.SERVER_ERROR
      )
    }
    return { url: session.url }
  })

export async function createDonationAction(
  ...args: Parameters<typeof _createDonationAction>
) {
  return _createDonationAction(...args)
}
