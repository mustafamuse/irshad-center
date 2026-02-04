'use server'

import { revalidatePath } from 'next/cache'

import { Prisma } from '@prisma/client'
import { z } from 'zod'

import { prisma } from '@/lib/db'
import { createActionLogger, logError } from '@/lib/logger'
import { mahadRegistrationSchema } from '@/lib/registration/schemas/registration'
import { createMahadStudent } from '@/lib/services/mahad/student-service'
import type { ActionResult } from '@/lib/utils/action-helpers'

const logger = createActionLogger('mahad-registration')

export async function registerStudent(
  studentData: z.infer<typeof mahadRegistrationSchema>
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

    const data = validationResult.data
    const fullName = `${data.firstName} ${data.lastName}`.trim()

    const emailExists = await checkEmailExists(data.email)
    if (emailExists) {
      return {
        success: false,
        error: 'A student with this email already exists',
        errors: { email: ['A student with this email already exists'] },
      }
    }

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

    revalidatePath('/admin/mahad')

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
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return {
        success: false,
        error: 'A student with this email already exists',
        errors: { email: ['A student with this email already exists'] },
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
    const normalizedEmail = email.toLowerCase().trim()

    const existingContact = await prisma.contactPoint.findFirst({
      where: {
        type: 'EMAIL',
        value: normalizedEmail,
      },
    })

    return existingContact !== null
  } catch (error) {
    await logError(logger, error, 'Email existence check failed', { email })
    throw error
  }
}
