import { createHmac, randomBytes, timingSafeEqual } from 'crypto'

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function getSessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET
  if (!secret) {
    throw new Error('ADMIN_SESSION_SECRET environment variable is required')
  }
  return secret
}

/**
 * Compare input password against plain text env var password.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function verifyEnvPassword(input: string, expected: string): boolean {
  if (!input || !expected) return false

  const inputBuffer = Buffer.from(input)
  const expectedBuffer = Buffer.from(expected)

  if (inputBuffer.length !== expectedBuffer.length) {
    return false
  }

  return timingSafeEqual(inputBuffer, expectedBuffer)
}

/**
 * Create a signed session token with embedded expiration.
 * Format: timestamp.randomData.signature
 */
export function createSessionToken(): string {
  const secret = getSessionSecret()
  const expiresAt = Date.now() + SESSION_DURATION_MS
  const randomData = randomBytes(32).toString('hex')
  const payload = `${expiresAt}.${randomData}`

  const signature = createHmac('sha256', secret)
    .update(payload)
    .digest('hex')

  return `${payload}.${signature}`
}

/**
 * Validate a session token's signature and expiration.
 */
export function isValidSessionToken(token: string | undefined): boolean {
  if (!token) return false

  const parts = token.split('.')
  if (parts.length !== 3) return false

  const [expiresAtStr, randomData, signature] = parts
  const expiresAt = parseInt(expiresAtStr, 10)

  if (isNaN(expiresAt) || !randomData || !signature) {
    return false
  }

  // Check expiration
  if (Date.now() > expiresAt) {
    return false
  }

  // Verify signature
  try {
    const secret = getSessionSecret()
    const payload = `${expiresAtStr}.${randomData}`
    const expectedSignature = createHmac('sha256', secret)
      .update(payload)
      .digest('hex')

    if (signature.length !== expectedSignature.length) {
      return false
    }

    return timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    )
  } catch {
    return false
  }
}

export function getSessionCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production'

  return {
    name: 'admin_session',
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: Math.floor(SESSION_DURATION_MS / 1000),
  }
}

/**
 * Server-side session validation for protected routes.
 * Validates the session cookie with full cryptographic verification.
 * Use this in Server Actions or API routes to verify admin access.
 */
export async function requireAdminSession(): Promise<boolean> {
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const token = cookieStore.get('admin_session')?.value
  return isValidSessionToken(token)
}
