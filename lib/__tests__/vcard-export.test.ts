import { describe, it, expect } from 'vitest'

import {
  escapeVCardValue,
  formatPhoneForVCard,
  generateVCard,
} from '../vcard-export'

describe('escapeVCardValue', () => {
  it('should escape backslashes', () => {
    expect(escapeVCardValue('test\\value')).toBe('test\\\\value')
  })

  it('should escape semicolons', () => {
    expect(escapeVCardValue('test;value')).toBe('test\\;value')
  })

  it('should escape commas', () => {
    expect(escapeVCardValue('test,value')).toBe('test\\,value')
  })

  it('should escape newlines', () => {
    expect(escapeVCardValue('test\nvalue')).toBe('test\\nvalue')
  })

  it('should handle multiple special characters', () => {
    expect(escapeVCardValue('a\\b;c,d\ne')).toBe('a\\\\b\\;c\\,d\\ne')
  })

  it('should return unchanged string when no special chars', () => {
    expect(escapeVCardValue('simple text')).toBe('simple text')
  })
})

describe('formatPhoneForVCard', () => {
  it('should return undefined for null', () => {
    expect(formatPhoneForVCard(null)).toBeUndefined()
  })

  it('should return undefined for undefined', () => {
    expect(formatPhoneForVCard(undefined)).toBeUndefined()
  })

  it('should return undefined for empty string', () => {
    expect(formatPhoneForVCard('')).toBeUndefined()
  })

  it('should format 10-digit US number with +1 prefix', () => {
    expect(formatPhoneForVCard('6125551234')).toBe('+16125551234')
  })

  it('should format 10-digit number with formatting', () => {
    expect(formatPhoneForVCard('(612) 555-1234')).toBe('+16125551234')
  })

  it('should format 11-digit number starting with 1', () => {
    expect(formatPhoneForVCard('16125551234')).toBe('+16125551234')
  })

  it('should format 11-digit number with formatting', () => {
    expect(formatPhoneForVCard('1-612-555-1234')).toBe('+16125551234')
  })

  it('should handle other digit lengths with + prefix', () => {
    expect(formatPhoneForVCard('12345')).toBe('+12345')
  })
})

describe('generateVCard', () => {
  it('should generate basic vCard with required fields', () => {
    const vcard = generateVCard({
      firstName: 'John Doe',
      lastName: '',
      fullName: 'John Doe',
    })

    expect(vcard).toContain('BEGIN:VCARD')
    expect(vcard).toContain('VERSION:3.0')
    expect(vcard).toContain('N:;John Doe;;;')
    expect(vcard).toContain('FN:John Doe')
    expect(vcard).toContain('END:VCARD')
  })

  it('should include phone when provided', () => {
    const vcard = generateVCard({
      firstName: 'John',
      lastName: 'Doe',
      fullName: 'John Doe',
      phone: '+16125551234',
    })

    expect(vcard).toContain('TEL;TYPE=CELL:+16125551234')
  })

  it('should include email when provided', () => {
    const vcard = generateVCard({
      firstName: 'John',
      lastName: 'Doe',
      fullName: 'John Doe',
      email: 'john@example.com',
    })

    expect(vcard).toContain('EMAIL:john@example.com')
  })

  it('should include organization when provided', () => {
    const vcard = generateVCard({
      firstName: 'John',
      lastName: 'Doe',
      fullName: 'John Doe',
      organization: 'Irshad Center',
    })

    expect(vcard).toContain('ORG:Irshad Center')
  })

  it('should include note when provided', () => {
    const vcard = generateVCard({
      firstName: 'John',
      lastName: 'Doe',
      fullName: 'John Doe',
      note: 'Children: Ahmed, Fatima',
    })

    expect(vcard).toContain('NOTE:Children: Ahmed\\, Fatima')
  })

  it('should escape special characters in fields', () => {
    const vcard = generateVCard({
      firstName: 'John; Jr.',
      lastName: 'Doe',
      fullName: 'John; Jr. Doe',
    })

    expect(vcard).toContain('N:Doe;John\\; Jr.;;;')
    expect(vcard).toContain('FN:John\\; Jr. Doe')
  })

  it('should use CRLF line endings', () => {
    const vcard = generateVCard({
      firstName: 'John',
      lastName: 'Doe',
      fullName: 'John Doe',
    })

    expect(vcard).toContain('\r\n')
    expect(vcard).not.toMatch(/[^\r]\n/)
  })
})
