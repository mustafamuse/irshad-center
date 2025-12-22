import { createHash, timingSafeEqual } from 'crypto'

const SESSION_SECRET =
  process.env.ADMIN_SESSION_SECRET || 'irshad-admin-session-secret'
const SESSION_DURATION_DAYS = 7

export function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex')
}

export function verifyPassword(input: string, expected: string): boolean {
  const inputHash = hashPassword(input)
  const expectedHash = hashPassword(expected)

  if (inputHash.length !== expectedHash.length) {
    return false
  }

  return timingSafeEqual(Buffer.from(inputHash), Buffer.from(expectedHash))
}

export function createSessionToken(): string {
  const timestamp = Date.now().toString()
  const random = Math.random().toString(36).substring(2)
  return createHash('sha256')
    .update(`${SESSION_SECRET}-${timestamp}-${random}`)
    .digest('hex')
}

export function getSessionCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production'

  return {
    name: 'admin_session',
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
  }
}

export function isValidSessionToken(token: string | undefined): boolean {
  if (!token) return false
  return token.length === 64
}
