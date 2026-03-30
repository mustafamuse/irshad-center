import { describe, it, expect } from 'vitest'

import { normalizePhone } from '@/lib/types/person'

import { normalizeEmail } from '../contact-normalization'

describe('normalizePhone', () => {
  it('strips leading 1 from 11-digit NANP number', () => {
    expect(normalizePhone('16125551234')).toBe('6125551234')
  })

  it('returns digits-only for valid 10-digit number', () => {
    expect(normalizePhone('(612) 555-1234')).toBe('6125551234')
  })

  it('returns digits-only for already clean number', () => {
    expect(normalizePhone('6125551234')).toBe('6125551234')
  })

  it('returns null for null input', () => {
    expect(normalizePhone(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(normalizePhone(undefined)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(normalizePhone('')).toBeNull()
  })

  it('returns null for too-short number', () => {
    expect(normalizePhone('12345')).toBeNull()
  })

  it('returns null for too-long number', () => {
    expect(normalizePhone('1234567890123456')).toBeNull()
  })

  it('rejects 11-digit non-NANP number', () => {
    expect(normalizePhone('26125551234')).toBeNull()
  })
})

describe('normalizeEmail', () => {
  it('lowercases and trims email', () => {
    expect(normalizeEmail('  Test@Example.COM  ')).toBe('test@example.com')
  })

  it('returns null for null input', () => {
    expect(normalizeEmail(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(normalizeEmail(undefined)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(normalizeEmail('')).toBeNull()
  })

  it('returns null for whitespace-only string', () => {
    expect(normalizeEmail('   ')).toBeNull()
  })
})
