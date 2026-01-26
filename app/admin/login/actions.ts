'use server'

import { revalidatePath } from 'next/cache'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'

import crypto from 'crypto'

import { generateAuthToken, verifyAuthToken } from '@/lib/auth/admin-auth'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import { createActionLogger, logError } from '@/lib/logger'
import { setSentryUser, clearSentryUser } from '@/lib/sentry/user-context'
import type { ActionResult } from '@/lib/utils/action-helpers'
import { adminPinSchema } from '@/lib/validations/admin-auth'

const logger = createActionLogger('admin-auth')

export async function validateAdminPin(
  pin: string,
  redirectTo: string
): Promise<ActionResult<void>> {
  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for')?.split(',')[0] || 'unknown'

  const rateLimitResult = await checkRateLimit(ip)
  if (!rateLimitResult.success) {
    logger.warn({ ip }, 'Rate limit exceeded for admin login')
    return {
      success: false,
      error: 'Too many attempts. Please try again later.',
    }
  }

  const parsed = adminPinSchema.safeParse({ pin, redirectTo })

  if (!parsed.success) {
    logger.warn({ error: parsed.error.flatten() }, 'Invalid PIN format')
    return { success: false, error: 'Invalid PIN format' }
  }

  const expectedPin = process.env.ADMIN_PIN

  if (!expectedPin) {
    logger.error('ADMIN_PIN environment variable not configured')
    return { success: false, error: 'Server configuration error' }
  }

  const pinBuffer = Buffer.from(parsed.data.pin)
  const expectedBuffer = Buffer.from(expectedPin)
  const isValid =
    pinBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(pinBuffer, expectedBuffer)

  if (!isValid) {
    await logError(
      logger,
      new Error('Invalid PIN attempt'),
      'Admin login failed',
      { ip }
    )
    return { success: false, error: 'Invalid PIN' }
  }

  const token = generateAuthToken()
  const cookieStore = await cookies()
  cookieStore.set('admin_auth', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24,
    path: '/',
  })

  setSentryUser({ id: 'admin', username: 'admin' })
  logger.info('Admin login successful')
  redirect(parsed.data.redirectTo)
}

export async function logoutAdmin(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete('admin_auth')
  clearSentryUser()
  logger.info('Admin logout')
  revalidatePath('/admin', 'layout')
  redirect('/admin/login')
}

export { verifyAuthToken }
