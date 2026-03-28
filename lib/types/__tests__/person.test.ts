import { describe, it, expect } from 'vitest'

import {
  ContactPointLike,
  getPrimaryEmail,
  getPrimaryPhone,
  getContactInfo,
} from '../person'

function cp(
  type: ContactPointLike['type'],
  value: string,
  overrides: Partial<ContactPointLike> = {}
): ContactPointLike {
  return { type, value, ...overrides }
}

describe('getPrimaryEmail', () => {
  it('returns null for null/undefined input', () => {
    expect(getPrimaryEmail(null)).toBeNull()
    expect(getPrimaryEmail(undefined)).toBeNull()
  })

  it('returns null for empty array', () => {
    expect(getPrimaryEmail([])).toBeNull()
  })

  it('returns the first email when no primary is set', () => {
    const points = [cp('EMAIL', 'a@test.com'), cp('EMAIL', 'b@test.com')]
    expect(getPrimaryEmail(points)).toBe('a@test.com')
  })

  it('prefers isPrimary email over first match', () => {
    const points = [
      cp('EMAIL', 'a@test.com'),
      cp('EMAIL', 'b@test.com', { isPrimary: true }),
    ]
    expect(getPrimaryEmail(points)).toBe('b@test.com')
  })

  it('skips INVALID contacts', () => {
    const points = [
      cp('EMAIL', 'invalid@test.com', {
        isPrimary: true,
        verificationStatus: 'INVALID',
      }),
      cp('EMAIL', 'valid@test.com'),
    ]
    expect(getPrimaryEmail(points)).toBe('valid@test.com')
  })

  it('skips inactive (soft-deleted) contacts', () => {
    const points = [
      cp('EMAIL', 'deleted@test.com', { isPrimary: true, isActive: false }),
      cp('EMAIL', 'active@test.com'),
    ]
    expect(getPrimaryEmail(points)).toBe('active@test.com')
  })

  it('returns null when all emails are ineligible', () => {
    const points = [
      cp('EMAIL', 'a@test.com', { isActive: false }),
      cp('EMAIL', 'b@test.com', { verificationStatus: 'INVALID' }),
    ]
    expect(getPrimaryEmail(points)).toBeNull()
  })

  it('ignores non-EMAIL types', () => {
    const points = [cp('PHONE', '1234567890')]
    expect(getPrimaryEmail(points)).toBeNull()
  })
})

describe('getPrimaryPhone', () => {
  it('returns null for null/undefined input', () => {
    expect(getPrimaryPhone(null)).toBeNull()
    expect(getPrimaryPhone(undefined)).toBeNull()
  })

  it('returns null for empty array', () => {
    expect(getPrimaryPhone([])).toBeNull()
  })

  it('returns PHONE type contact', () => {
    const points = [cp('PHONE', '1234567890')]
    expect(getPrimaryPhone(points)).toBe('1234567890')
  })

  it('returns WHATSAPP type as phone', () => {
    const points = [cp('WHATSAPP', '9876543210')]
    expect(getPrimaryPhone(points)).toBe('9876543210')
  })

  it('prefers isPrimary phone over first match', () => {
    const points = [
      cp('PHONE', '1111111111'),
      cp('WHATSAPP', '2222222222', { isPrimary: true }),
    ]
    expect(getPrimaryPhone(points)).toBe('2222222222')
  })

  it('skips INVALID and inactive contacts', () => {
    const points = [
      cp('PHONE', '1111111111', { verificationStatus: 'INVALID' }),
      cp('PHONE', '2222222222', { isActive: false }),
      cp('WHATSAPP', '3333333333'),
    ]
    expect(getPrimaryPhone(points)).toBe('3333333333')
  })

  it('ignores non-phone types', () => {
    const points = [cp('EMAIL', 'a@test.com')]
    expect(getPrimaryPhone(points)).toBeNull()
  })
})

describe('getContactInfo', () => {
  it('returns both email and phone', () => {
    const points = [
      cp('EMAIL', 'a@test.com', { isPrimary: true }),
      cp('PHONE', '1234567890'),
    ]
    expect(getContactInfo(points)).toEqual({
      email: 'a@test.com',
      phone: '1234567890',
    })
  })

  it('returns nulls for empty array', () => {
    expect(getContactInfo([])).toEqual({ email: null, phone: null })
  })

  it('returns nulls for null input', () => {
    expect(getContactInfo(null)).toEqual({ email: null, phone: null })
  })
})
