const MAX_TOKEN_AGE_MS = 24 * 60 * 60 * 1000

function constantTimeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length)
  let result = a.length ^ b.length
  for (let i = 0; i < len; i++) {
    result |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  }
  return result === 0
}

export async function verifyAuthTokenEdge(token: string): Promise<boolean> {
  try {
    const [timestamp, signature] = token.split('.')
    if (!timestamp || !signature) return false

    const tokenAge = Date.now() - parseInt(timestamp, 10)
    if (isNaN(tokenAge) || tokenAge > MAX_TOKEN_AGE_MS || tokenAge < 0) {
      return false
    }

    const secret = process.env.ADMIN_PIN
    if (!secret) throw new Error('ADMIN_PIN environment variable is required')
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(timestamp)
    )
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    return constantTimeEqual(signature, expectedSignature)
  } catch (error) {
    if (error instanceof Error && error.message.includes('ADMIN_PIN')) {
      throw error
    }
    return false
  }
}
