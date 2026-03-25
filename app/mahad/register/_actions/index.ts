'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { headers } from 'next/headers'
import { after } from 'next/server'

import { Prisma } from '@prisma/client'

import { checkRateLimit } from '@/lib/auth/rate-limit'
import { MAHAD_PROGRAM } from '@/lib/constants/mahad'
import { ActionError } from '@/lib/errors/action-error'
import { createActionLogger, logError } from '@/lib/logger'
import {
  mahadRegistrationSchema,
  type MahadRegistrationValues,
} from '@/lib/registration/schemas/registration'
import { DuplicateDetectionService } from '@/lib/services/duplicate-detection-service'
import { createMahadStudent } from '@/lib/services/mahad/student-service'
import type { ActionResult } from '@/lib/utils/action-helpers'

const logger = createActionLogger('mahad-registration')

export async function registerStudent(
  studentData: MahadRegistrationValues
): Promise<ActionResult<{ id: string; name: string }>> {
  try {
    const validationResult = mahadRegistrationSchema.safeParse(studentData)
    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0]
      const field = firstError.path[0] as string
      return {
        success: false,
        error: firstError.message,
        errors: field ? { [field]: [firstError.message] } : undefined,
      }
    }

    try {
      const headerStore = await headers()
      const ip = headerStore.get('x-forwarded-for')?.split(',')[0]?.trim()
      if (ip) {
        const rateResult = await checkRateLimit(`register:${ip}`)
        if (!rateResult.success) {
          return {
            success: false,
            error: 'Too many registration attempts. Please try again later.',
          }
        }
      }
    } catch {
      // Fail open if headers/rate-limit unavailable
    }

    const data = validationResult.data
    const fullName = `${data.firstName} ${data.lastName}`.trim()

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
      revalidatePath('/admin/mahad')
    })

    logger.info(
      { profileId: profile.id, name: fullName },
      'Student registration completed'
    )

    return {
      success: true,
      data: {
        id: profile.id,
        name: fullName,
      },
    }
  } catch (error) {
    if (error instanceof ActionError) {
      return {
        success: false,
        error: error.message,
        errors: error.field
          ? { [error.field]: [error.message] }
          : { email: [error.message] },
      }
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return {
        success: false,
        error: 'A student with this contact information already exists',
      }
    }
    await logError(logger, error, 'Mahad registration failed')
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Registration failed. Please try again.',
    }
  }
}

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
