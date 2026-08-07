import { describe, it, expect } from 'vitest'

import { maskEmail, maskPhone } from '../mask'

describe('maskEmail', () => {
  it('keeps first character and domain only', () => {
    expect(maskEmail('mother@gmail.com')).toBe('m•••@gmail.com')
  })

  it('normalizes case and whitespace so query-masking matches stored masks', () => {
    expect(maskEmail(' Mother@Gmail.com ')).toBe('m•••@gmail.com')
  })

  it('returns null for null, empty, or malformed input', () => {
    expect(maskEmail(null)).toBeNull()
    expect(maskEmail('')).toBeNull()
    expect(maskEmail('@gmail.com')).toBeNull()
    expect(maskEmail('no-at-sign')).toBeNull()
  })

  it('never contains the local part beyond the first character', () => {
    const masked = maskEmail('somelongaddress@example.org')
    expect(masked).not.toContain('omelongaddress')
  })
})

describe('maskPhone', () => {
  it('keeps only the last 4 digits', () => {
    expect(maskPhone('612-555-1234')).toBe('•••-•••-1234')
    expect(maskPhone('(612) 555-1234')).toBe('•••-•••-1234')
    expect(maskPhone('+1 612 555 1234')).toBe('•••-•••-1234')
  })

  it('masks a bare last-4 query to the same form as a full number', () => {
    expect(maskPhone('1234')).toBe(maskPhone('612-555-1234'))
  })

  it('returns null for null or too-short input', () => {
    expect(maskPhone(null)).toBeNull()
    expect(maskPhone('123')).toBeNull()
    expect(maskPhone('')).toBeNull()
  })
})
