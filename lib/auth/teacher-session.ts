import crypto from 'node:crypto'

const TTL_MS = 30 * 60 * 1000

function getSecret(): string {
  const secret = process.env.TEACHER_SESSION_SECRET
  if (!secret)
    throw new Error('TEACHER_SESSION_SECRET environment variable is not set')
  return secret
}

export function generateTeacherToken(teacherId: string): string {
  const secret = getSecret()
  const expiry = (Date.now() + TTL_MS).toString()
  const payload = `${teacherId}|${expiry}`
  const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  return `${teacherId}|${expiry}|${hmac}`
}

export function verifyTeacherToken(token: string): string | null {
  try {
    const secret = process.env.TEACHER_SESSION_SECRET
    if (!secret) return null

    const parts = token.split('|')
    if (parts.length !== 3) return null

    const [teacherId, expiry, hmac] = parts
    if (!teacherId || !expiry || !hmac) return null

    const expiryMs = parseInt(expiry, 10)
    if (isNaN(expiryMs) || Date.now() > expiryMs) return null

    const payload = `${teacherId}|${expiry}`
    const expectedHmac = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex')

    const valid = crypto.timingSafeEqual(
      Buffer.from(hmac),
      Buffer.from(expectedHmac)
    )

    return valid ? teacherId : null
  } catch {
    return null
  }
}
