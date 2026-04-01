import { describe, it, expect } from 'vitest'

import { normalizePhone } from '@/lib/types/person'

import { normalizeEmail } from '../contact-normalization'

describe('normalizePhone', () => {
  it('normalizes 11-digit NANP to E.164', () => {
    expect(normalizePhone('16125551234')).toBe('+16125551234')
  })

  it('normalizes formatted US number to E.164', () => {
    expect(normalizePhone('(612) 555-1234')).toBe('+16125551234')
  })

  it('normalizes 10-digit US number to E.164', () => {
    expect(normalizePhone('6125551234')).toBe('+16125551234')
  })

  it('passes through already-normalized E.164 US', () => {
    expect(normalizePhone('+16125551234')).toBe('+16125551234')
  })

  it('normalizes Somali number (+252) to E.164', () => {
    expect(normalizePhone('+252612345678')).toBe('+252612345678')
  })

  it('normalizes formatted Somali number to E.164', () => {
    expect(normalizePhone('+252 61 234 5678')).toBe('+252612345678')
  })

  it('normalizes 12-digit international number without + to E.164', () => {
    expect(normalizePhone('252612345678')).toBe('+252612345678')
  })

  it('normalizes 11-digit international number (not NANP)', () => {
    expect(normalizePhone('26125551234')).toBe('+26125551234')
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
