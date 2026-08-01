'use server'

import { createActionLogger } from '@/lib/logger'
import { mahadLookupByEmailSchema } from '@/lib/registration/schemas/mahad-lookup-by-email'
import { rateLimitedActionClient } from '@/lib/safe-action'
import { lookupByEmail } from '@/lib/services/mahad/verification-service'

const logger = createActionLogger('mahad-lookup-by-email')

const _lookupMahadByEmail = rateLimitedActionClient
  .metadata({ actionName: 'mahadLookupByEmail', maxAttempts: 3 })
  .schema(mahadLookupByEmailSchema)
  .action(async ({ parsedInput }) => {
    const start = Date.now()
    const result = await lookupByEmail(parsedInput.email)
    logger.info(
      {
        method: 'email',
        outcome: result.found ? 'found' : 'not_found',
        durationMs: Date.now() - start,
      },
      'mahad.lookup.attempt'
    )
    return result
  })

export async function lookupMahadByEmail(
  ...args: Parameters<typeof _lookupMahadByEmail>
) {
  return _lookupMahadByEmail(...args)
}
