'use server'

import { revalidatePath } from 'next/cache'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { checkRateLimit } from '@/lib/auth/rate-limit'
import {
  authenticateTeacher,
  generateTeacherAuthToken,
} from '@/lib/auth/teacher-auth'
import { createActionLogger, logError, logInfo } from '@/lib/logger'
import type { ActionResult } from '@/lib/utils/action-helpers'
import { TeacherLoginSchema } from '@/lib/validations/teacher-auth'

const logger = createActionLogger('teacher-auth')

export async function validateTeacherLogin(
  lastFour: string,
  redirectTo: string
): Promise<ActionResult<void>> {
  const parsed = TeacherLoginSchema.safeParse({ lastFour, redirectTo })
  if (!parsed.success) {
    return { success: false, error: 'Invalid format. Enter 4 digits.' }
  }

  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for')?.split(',')[0] || 'unknown'

  const rateLimitResult = await checkRateLimit(`teacher:${ip}`)
  if (!rateLimitResult.success) {
    logger.warn({ ip }, 'Rate limit exceeded for teacher login')
    return {
      success: false,
      error: 'Too many attempts. Please try again later.',
    }
  }

  const teacher = await authenticateTeacher(parsed.data.lastFour)
  if (!teacher) {
    void logError(
      logger,
      new Error('Teacher login failed'),
      'No unique teacher match',
      { ip }
    )
    return { success: false, error: 'No matching teacher found' }
  }

  const token = generateTeacherAuthToken(teacher.teacherId)
  const cookieStore = await cookies()
  cookieStore.set('teacher_auth', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24,
    path: '/teacher',
  })

  void logInfo(logger, 'Teacher login successful', {
    ip,
    teacherId: teacher.teacherId,
  })
  redirect(parsed.data.redirectTo)
}

export async function logoutTeacher(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete({ name: 'teacher_auth', path: '/teacher' })
  revalidatePath('/teacher', 'layout')
  redirect('/teacher/login')
}
