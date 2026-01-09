'use server'


import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import crypto from 'crypto'

import { createActionLogger } from '@/lib/logger'
import type { ActionResult } from '@/lib/utils/action-helpers'
import { adminPinSchema } from '@/lib/validations/admin-auth'

const logger = createActionLogger('admin-auth')

function generateAuthToken(): string {
  const timestamp = Date.now().toString()
  const secret = process.env.ADMIN_PIN || ''
  const signature = crypto
    .createHmac('sha256', secret)
    .update(timestamp)
    .digest('hex')
  return `${timestamp}.${signature}`
}

function verifyAuthToken(token: string): boolean {
  const [timestamp, signature] = token.split('.')
  if (!timestamp || !signature) return false

  const secret = process.env.ADMIN_PIN || ''
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(timestamp)
    .digest('hex')

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}

export async function validateAdminPin(
  pin: string,
  redirectTo: string
): Promise<ActionResult> {
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

  if (parsed.data.pin !== expectedPin) {
    logger.warn('Failed admin login attempt')
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

  logger.info('Admin login successful')
  redirect(parsed.data.redirectTo)
}

export async function logoutAdmin(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete('admin_auth')
  logger.info('Admin logout')
  redirect('/admin/login')
}

export { verifyAuthToken }
