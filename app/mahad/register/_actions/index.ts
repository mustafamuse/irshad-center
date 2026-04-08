'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { headers } from 'next/headers'
import { after } from 'next/server'

import { Prisma } from '@prisma/client'
import { returnValidationErrors } from 'next-safe-action'

import { checkRateLimit } from '@/lib/auth/rate-limit'
import { MAHAD_PROGRAM } from '@/lib/constants/mahad'
import { ActionError } from '@/lib/errors/action-error'
import { createActionLogger } from '@/lib/logger'
import { mahadRegistrationSchema } from '@/lib/registration/schemas/registration'
import { rateLimitedActionClient } from '@/lib/safe-action'
import { DuplicateDetectionService } from '@/lib/services/duplicate-detection-service'
import { createMahadStudent } from '@/lib/services/mahad/student-service'

const logger = createActionLogger('mahad-registration')

const _registerStudent = rateLimitedActionClient
  .metadata({ actionName: 'registerStudent' })
  .schema(mahadRegistrationSchema)
  .action(async ({ parsedInput: data }) => {
    const fullName = `${data.firstName} ${data.lastName}`.trim()

    try {
      const profile = await createMahadStudent({
        name: fullName,
        email: data.email,
        phone: data.phone,
        dateOfBirth: data.dateOfBirth,
        gradeLevel: data.gradeLevel,
        schoolName: data.schoolName,
        graduationStatus: data.graduationStatus,
        paymentFrequency: data.paymentFrequency,
      })

      after(() => {
        revalidateTag('mahad-stats')
        revalidateTag('mahad-students')
        revalidatePath('/admin/mahad')
      })

      logger.info(
        { profileId: profile.id, name: fullName },
        'Student registration completed'
      )

      return { id: profile.id, name: fullName }
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
export async function checkEmailExists(email: string): Promise<boolean> {
  try {
    const headerStore = await headers()
    const ip = headerStore.get('x-forwarded-for')?.split(',')[0]?.trim()
    if (ip) {
      const rateResult = await checkRateLimit(`email-check:${ip}`, 10)
      if (!rateResult.success) {
        return false
      }
    }
  } catch {
    // Fail open if headers/rate-limit unavailable
  }

  return DuplicateDetectionService.isEmailRegistered(email, MAHAD_PROGRAM)
}
