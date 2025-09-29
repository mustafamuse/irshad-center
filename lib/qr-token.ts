import jwt from 'jsonwebtoken'

const JWT_SECRET =
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
const TOKEN_EXPIRY = '60s' // 60 seconds for security

export interface QRTokenPayload {
  sessionId: string
  iat: number
  exp: number
}

export function generateQRToken(sessionId: string): string {
  return jwt.sign({ sessionId }, JWT_SECRET, {
    expiresIn: TOKEN_EXPIRY,
    algorithm: 'HS256',
  })
}

export function verifyQRToken(token: string): QRTokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
    }) as QRTokenPayload

    return decoded
  } catch (error) {
    // Token expired, invalid, or malformed
    return null
  }
}

export function isTokenExpired(payload: QRTokenPayload): boolean {
  const now = Math.floor(Date.now() / 1000)
  return payload.exp < now
}

export function getTokenTimeRemaining(payload: QRTokenPayload): number {
  const now = Math.floor(Date.now() / 1000)
  return Math.max(0, payload.exp - now)
}
