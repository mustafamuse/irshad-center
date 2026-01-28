const MAX_TOKEN_AGE_MS = 24 * 60 * 60 * 1000

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

export async function verifyTeacherAuthTokenEdge(
  token: string
): Promise<boolean> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return false

    const [teacherId, timestamp, signature] = parts
    if (!teacherId || !timestamp || !signature) return false

    const tokenAge = Date.now() - parseInt(timestamp, 10)
    if (isNaN(tokenAge) || tokenAge > MAX_TOKEN_AGE_MS || tokenAge < 0) {
      return false
    }

    const secret = process.env.TEACHER_AUTH_SECRET
    if (!secret)
      throw new Error('TEACHER_AUTH_SECRET environment variable is required')
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const data = `${teacherId}.${timestamp}`
    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(data)
    )
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    return constantTimeEqual(signature, expectedSignature)
  } catch {
    return false
  }
}
