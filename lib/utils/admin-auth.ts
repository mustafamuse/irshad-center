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
 * Compare input password against env var password using timing-safe comparison.
 *
 * SECURITY NOTE: Using plain text in env vars is acceptable here because:
 * 1. Env vars are not exposed to clients and are secure on Vercel/server environments
 * 2. This is a single shared admin password, not user credentials
 * 3. Timing-safe comparison prevents timing attacks
 * 4. For user passwords stored in a database, use bcrypt/argon2 instead
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

/**
 * Higher-order function to protect server actions with admin authentication.
 * Wraps an action and returns unauthorized error if session is invalid.
 *
 * @example
 * export const myProtectedAction = withAdminAuth(async (input: Input) => {
 *   // Action logic here - only runs if authenticated
 *   return { success: true, data: result }
 * })
 */
export function withAdminAuth<TInput, TOutput>(
  action: (input: TInput) => Promise<{ success: true; data: TOutput } | { success: false; error: string }>
) {
  return async (input: TInput): Promise<{ success: true; data: TOutput } | { success: false; error: string }> => {
    const isAuthed = await requireAdminSession()
    if (!isAuthed) {
      return { success: false, error: 'Unauthorized' }
    }
    return action(input)
  }
}
