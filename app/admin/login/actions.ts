'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import crypto from 'crypto'

import { generateAuthToken, verifyAuthToken } from '@/lib/auth/admin-auth'
import { ActionError, ERROR_CODES } from '@/lib/errors/action-error'
import { createActionLogger, logInfo } from '@/lib/logger'
import { actionClient, rateLimitedActionClient } from '@/lib/safe-action'
import { clearSentryUser, setSentryUser } from '@/lib/sentry/user-context'
import { adminPinSchema } from '@/lib/validations/admin-auth'

const logger = createActionLogger('admin-auth')

export const validateAdminPin = rateLimitedActionClient
  .metadata({ actionName: 'validateAdminPin' })
  .schema(adminPinSchema)
  .action(async ({ parsedInput: { pin, redirectTo } }) => {
    const expectedPin = process.env.ADMIN_PIN

    if (!expectedPin) {
      throw new ActionError(
        'Server configuration error',
        ERROR_CODES.SERVER_ERROR,
        undefined,
        500
      )
    }

    const pinBuffer = Buffer.from(pin)
    const expectedBuffer = Buffer.from(expectedPin)
    const isValid =
      pinBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(pinBuffer, expectedBuffer)

    if (!isValid) {
      throw new ActionError(
        'Invalid PIN',
        ERROR_CODES.VALIDATION_ERROR,
        'pin',
        401
      )
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
    await logInfo(logger, 'Admin login successful', { redirectTo })
    redirect(redirectTo)
  })

export const logoutAdmin = actionClient
  .metadata({ actionName: 'logoutAdmin' })
  .action(async () => {
    const cookieStore = await cookies()
    cookieStore.delete('admin_auth')
    clearSentryUser()
    await logInfo(logger, 'Admin logout', {})
    revalidatePath('/admin', 'layout')
    redirect('/admin/login')
  })

export { verifyAuthToken }
