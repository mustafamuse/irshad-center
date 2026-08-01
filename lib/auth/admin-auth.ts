import crypto from 'crypto'
import { cache } from 'react'

import { cookies } from 'next/headers'

const MAX_TOKEN_AGE_MS = 24 * 60 * 60 * 1000

export function generateAuthToken(): string {
  const secret = process.env.ADMIN_PIN
  if (!secret) throw new Error('ADMIN_PIN environment variable is not set')
  const timestamp = Date.now().toString()
  const signature = crypto
    .createHmac('sha256', secret)
    .update(timestamp)
    .digest('hex')
  return `${timestamp}.${signature}`
}

export function verifyAuthToken(token: string): boolean {
  try {
    const secret = process.env.ADMIN_PIN
    if (!secret) return false

    const [timestamp, signature] = token.split('.')
    if (!timestamp || !signature) return false

    const tokenAge = Date.now() - parseInt(timestamp, 10)
    if (isNaN(tokenAge) || tokenAge > MAX_TOKEN_AGE_MS || tokenAge < 0) {
      return false
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(timestamp)
      .digest('hex')

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  } catch {
    return false
  }
}

export const getVerifiedAuth = cache(
  async (): Promise<{ admin: true } | null> => {
    const cookieStore = await cookies()
    const token = cookieStore.get('admin_auth')?.value
    if (!token) return null
    return verifyAuthToken(token) ? { admin: true } : null
  }
)
