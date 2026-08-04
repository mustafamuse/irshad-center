import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createInviteToken, verifyInviteToken } from '../invite-token'

const PROFILE_ID = 'a1b2c3d4-0000-4000-8000-000000000001'

describe('invite-token', () => {
  beforeEach(() => {
    process.env.MAHAD_INVITE_SECRET = 'test-secret'
  })
  afterEach(() => {
    delete process.env.MAHAD_INVITE_SECRET
  })

  it('round-trips create -> verify', () => {
    const token = createInviteToken(PROFILE_ID)
    expect(verifyInviteToken(token)).toBe(PROFILE_ID)
  })

  it('token shape is profileId.32-hex-sig', () => {
    const token = createInviteToken(PROFILE_ID)
    const [id, sig] = token.split('.')
    expect(id).toBe(PROFILE_ID)
    expect(sig).toMatch(/^[0-9a-f]{32}$/)
  })

  it('rejects a tampered signature', () => {
    const token = createInviteToken(PROFILE_ID)
    const [id, sig] = token.split('.')
    const flipped = (sig[0] === 'a' ? 'b' : 'a') + sig.slice(1)
    expect(verifyInviteToken(`${id}.${flipped}`)).toBeNull()
  })

  it('rejects a token signed for a different profile', () => {
    const other = createInviteToken('a1b2c3d4-0000-4000-8000-000000000002')
    const [, sig] = other.split('.')
    expect(verifyInviteToken(`${PROFILE_ID}.${sig}`)).toBeNull()
  })

  it.each(['', 'no-dot', 'a.b.c', `${PROFILE_ID}.zzzz`, null, undefined])(
    'rejects malformed input %#',
    (bad) => {
      expect(verifyInviteToken(bad as string)).toBeNull()
    }
  )

  it('verify returns null when MAHAD_INVITE_SECRET is unset', () => {
    const token = createInviteToken(PROFILE_ID)
    delete process.env.MAHAD_INVITE_SECRET
    expect(verifyInviteToken(token)).toBeNull()
  })

  it('create throws when MAHAD_INVITE_SECRET is unset', () => {
    delete process.env.MAHAD_INVITE_SECRET
    expect(() => createInviteToken(PROFILE_ID)).toThrow()
  })
})
