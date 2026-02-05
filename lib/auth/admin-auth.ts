import crypto from 'crypto'

const MAX_TOKEN_AGE_MS = 24 * 60 * 60 * 1000

export function generateAuthToken(): string {
  const timestamp = Date.now().toString()
  const secret = process.env.ADMIN_PIN
  if (!secret) throw new Error('ADMIN_PIN environment variable is required')
  const signature = crypto
    .createHmac('sha256', secret)
    .update(timestamp)
    .digest('hex')
  return `${timestamp}.${signature}`
}

export function verifyAuthToken(token: string): boolean {
  try {
    const [timestamp, signature] = token.split('.')
    if (!timestamp || !signature) return false

    const tokenAge = Date.now() - parseInt(timestamp, 10)
    if (isNaN(tokenAge) || tokenAge > MAX_TOKEN_AGE_MS || tokenAge < 0) {
      return false
    }

    const secret = process.env.ADMIN_PIN
    if (!secret) throw new Error('ADMIN_PIN environment variable is required')
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(timestamp)
      .digest('hex')

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  } catch (error) {
    if (error instanceof Error && error.message.includes('ADMIN_PIN')) {
      throw error
    }
    return false
  }
}
