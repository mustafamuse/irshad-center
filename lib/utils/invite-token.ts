import { createHmac, timingSafeEqual } from 'node:crypto'

const SIG_LENGTH = 32

function sign(profileId: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(profileId)
    .digest('hex')
    .slice(0, SIG_LENGTH)
}

export function createInviteToken(profileId: string): string {
  const secret = process.env.MAHAD_INVITE_SECRET
  if (!secret) {
    throw new Error('MAHAD_INVITE_SECRET is not set')
  }
  return `${profileId}.${sign(profileId, secret)}`
}

export function verifyInviteToken(
  token: string | null | undefined
): string | null {
  const secret = process.env.MAHAD_INVITE_SECRET
  if (!secret || !token) return null

  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [profileId, sig] = parts
  if (!profileId || sig.length !== SIG_LENGTH) return null

  const expected = sign(profileId, secret)
  const a = Buffer.from(sig, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length) return null
  return timingSafeEqual(a, b) ? profileId : null
}
