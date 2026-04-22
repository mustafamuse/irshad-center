'use server'

import { findMahadRegistrationByNameAndPhoneLast4 } from '@/lib/db/queries/mahad-public-lookup'
import { createActionLogger, logError } from '@/lib/logger'
import { mahadStudentLookupSchema } from '@/lib/mahad/student-lookup-schema'
import { rateLimitedActionClient } from '@/lib/safe-action'

const logger = createActionLogger('mahad-student-lookup')

const _lookupMahadRegistration = rateLimitedActionClient
  .metadata({ actionName: 'mahadPublicRegistrationLookup' })
  .schema(mahadStudentLookupSchema)
  .action(async ({ parsedInput }) => {
    try {
      const result = await findMahadRegistrationByNameAndPhoneLast4(
        parsedInput.firstName,
        parsedInput.lastName,
        parsedInput.phoneLast4
      )

      if (!result.found) {
        return { found: false as const }
      }

      return {
        found: true as const,
        studentName: result.studentName,
        registeredAt: result.registeredAt,
        programStatusLabel: result.programStatusLabel,
      }
    } catch (error) {
      await logError(logger, error, 'Mahad student lookup failed', {
        firstName: parsedInput.firstName,
        lastName: parsedInput.lastName,
      })
      throw error
    }
  })

export async function lookupMahadRegistration(
  ...args: Parameters<typeof _lookupMahadRegistration>
) {
  return _lookupMahadRegistration(...args)
}
