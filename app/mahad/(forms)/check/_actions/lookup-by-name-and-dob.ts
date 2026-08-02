'use server'

import { createActionLogger } from '@/lib/logger'
import { mahadLookupByNameAndDobSchema } from '@/lib/registration/schemas/mahad-lookup-by-name-and-dob'
import { rateLimitedActionClient } from '@/lib/safe-action'
import { lookupByNameAndDob } from '@/lib/services/mahad/verification-service'

const logger = createActionLogger('mahad-lookup-by-name-and-dob')

const _lookupMahadByNameAndDob = rateLimitedActionClient
  .metadata({ actionName: 'mahadLookupByNameAndDob', maxAttempts: 3 })
  .schema(mahadLookupByNameAndDobSchema)
  .action(async ({ parsedInput }) => {
    const start = Date.now()
    const result = await lookupByNameAndDob({
      firstName: parsedInput.firstName,
      lastName: parsedInput.lastName,
      dateOfBirth: parsedInput.dateOfBirth,
    })
    logger.info(
      {
        method: 'name_dob',
        outcome: result.found ? 'found' : 'not_found',
        durationMs: Date.now() - start,
      },
      'mahad.lookup.attempt'
    )
    return result
  })

export async function lookupMahadByNameAndDob(
  ...args: Parameters<typeof _lookupMahadByNameAndDob>
) {
  return _lookupMahadByNameAndDob(...args)
}
