'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { headers } from 'next/headers'
import { after } from 'next/server'

import { Prisma } from '@prisma/client'
import { returnValidationErrors } from 'next-safe-action'

import { checkRateLimit } from '@/lib/auth/rate-limit'
import { MAHAD_PROGRAM } from '@/lib/constants/mahad'
import { ActionError } from '@/lib/errors/action-error'
import { createActionLogger, logError } from '@/lib/logger'
import { mahadRegistrationSchema } from '@/lib/registration/schemas/mahad-registration'
import { emailSchema } from '@/lib/registration/schemas/registration-field-schemas'
import { rateLimitedActionClient } from '@/lib/safe-action'
import { DuplicateDetectionService } from '@/lib/services/duplicate-detection-service'
import { registerMahadStudent } from '@/lib/services/mahad/registration-service'
import { verifyInviteToken } from '@/lib/utils/invite-token'

const logger = createActionLogger('mahad-registration')

const _registerStudent = rateLimitedActionClient
  .metadata({ actionName: 'registerStudent' })
  .schema(mahadRegistrationSchema)
  .action(async ({ parsedInput: data }) => {
    const fullName = `${data.firstName} ${data.lastName}`.trim()
    const inviteProfileId = verifyInviteToken(data.inviteToken) ?? null

    try {
      const result = await registerMahadStudent({
        name: fullName,
        email: data.email,
        phone: data.phone,
        dateOfBirth: data.dateOfBirth,
        gradeLevel: data.gradeLevel,
        schoolName: data.schoolName,
        graduationStatus: data.graduationStatus,
        paymentFrequency: data.paymentFrequency,
        inviteProfileId,
      })

      after(() => {
        revalidateTag('mahad-stats')
        revalidateTag('mahad-students')
        revalidatePath('/admin/mahad')
      })

      logger.info(
        { profileId: result.profileId },
        'Student registration completed'
      )

      return { profileId: result.profileId, name: fullName }
    } catch (error) {
      if (error instanceof ActionError && error.field) {
        if (error.field === 'phone') {
          returnValidationErrors(mahadRegistrationSchema, {
            phone: { _errors: [error.message] },
          })
        } else {
          returnValidationErrors(mahadRegistrationSchema, {
            email: { _errors: [error.message] },
          })
        }
      } else if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const target = (error.meta?.target as string[]) ?? []
        if (target.includes('phone')) {
          returnValidationErrors(mahadRegistrationSchema, {
            phone: {
              _errors: ['This phone is already registered to another student'],
            },
          })
        } else {
          returnValidationErrors(mahadRegistrationSchema, {
            email: {
              _errors: [
                target.includes('email')
                  ? 'This email is already registered to another student'
                  : 'A student with this contact information already exists',
              ],
            },
          })
        }
      }
      await logError(logger, error, 'Unexpected error in Mahad registration', {
        hasEmail: !!data.email,
        hasPhone: !!data.phone,
      })
      throw error
    }
  })

export async function registerStudent(
  ...args: Parameters<typeof _registerStudent>
) {
  return _registerStudent(...args)
}

// Returns boolean (not a safe-action result) because the client-side
// useEmailValidation hook expects a plain boolean for inline field validation.
// Malformed / oversized input short-circuits to `false` to avoid hitting the
// database with unvalidated public input (rule #8: validate ALL external input).
export async function checkEmailExists(email: string): Promise<boolean> {
  const parsed = emailSchema.safeParse(email)
  if (!parsed.success) return false

  // Budget matches mahadLookupByEmail (3 per window): this endpoint answers
  // the same "is this email registered?" question, so a looser cap here
  // would undo the tighter one there. Fails closed — an Upstash outage must
  // not turn this into an unthrottled enumeration oracle.
  const headerStore = await headers()
  const ip =
    headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headerStore.get('x-real-ip')?.trim() ||
    'unknown'
  const rateResult = await checkRateLimit(`email-check:${ip}`, 3, {
    failClosed: true,
  })
  if (!rateResult.success) {
    return false
  }

  try {
    return await DuplicateDetectionService.isEmailRegistered(
      parsed.data,
      MAHAD_PROGRAM
    )
  } catch (error) {
    await logError(logger, error, 'Email existence check failed', {})
    return false
  }
}
