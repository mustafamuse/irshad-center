import { describe, it, expect } from 'vitest'

import type { MinimalContactPoint } from '../query-builders'
import {
  extractPrimaryEmail,
  extractPrimaryPhone,
  extractContactInfo,
} from '../query-builders'

describe('extractPrimaryEmail', () => {
  it('returns primary email when isPrimary=true', () => {
    const contacts: MinimalContactPoint[] = [
      { type: 'EMAIL', value: 'primary@example.com', isPrimary: true },
    ]
    expect(extractPrimaryEmail(contacts)).toBe('primary@example.com')
  })

  it('falls back to any email when no isPrimary=true', () => {
    const contacts: MinimalContactPoint[] = [
      { type: 'EMAIL', value: 'fallback@example.com', isPrimary: false },
    ]
    expect(extractPrimaryEmail(contacts)).toBe('fallback@example.com')
  })

  it('returns null for empty array', () => {
    expect(extractPrimaryEmail([])).toBeNull()
  })

  it('returns null for null input', () => {
    expect(extractPrimaryEmail(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(extractPrimaryEmail(undefined)).toBeNull()
  })

  it('returns null when only PHONE contacts exist', () => {
    const contacts: MinimalContactPoint[] = [
      { type: 'PHONE', value: '6125551234', isPrimary: true },
    ]
    expect(extractPrimaryEmail(contacts)).toBeNull()
  })

  it('prefers isPrimary=true over isPrimary=false with multiple emails', () => {
    const contacts: MinimalContactPoint[] = [
      { type: 'EMAIL', value: 'secondary@example.com', isPrimary: false },
      { type: 'EMAIL', value: 'primary@example.com', isPrimary: true },
    ]
    expect(extractPrimaryEmail(contacts)).toBe('primary@example.com')
  })

  it('handles isPrimary=undefined as eligible', () => {
    const contacts: MinimalContactPoint[] = [
      { type: 'EMAIL', value: 'default@example.com' },
    ]
    expect(extractPrimaryEmail(contacts)).toBe('default@example.com')
  })
})

describe('extractPrimaryPhone', () => {
  it('returns primary phone when isPrimary=true', () => {
    const contacts: MinimalContactPoint[] = [
      { type: 'PHONE', value: '6125551234', isPrimary: true },
    ]
    expect(extractPrimaryPhone(contacts)).toBe('6125551234')
  })

  it('falls back to any phone when no isPrimary=true', () => {
    const contacts: MinimalContactPoint[] = [
      { type: 'PHONE', value: '6125551234', isPrimary: false },
    ]
    expect(extractPrimaryPhone(contacts)).toBe('6125551234')
  })

  it('returns null for empty array', () => {
    expect(extractPrimaryPhone([])).toBeNull()
  })

  it('returns null for null input', () => {
    expect(extractPrimaryPhone(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(extractPrimaryPhone(undefined)).toBeNull()
  })

  it('returns null when only EMAIL contacts exist', () => {
    const contacts: MinimalContactPoint[] = [
      { type: 'EMAIL', value: 'test@example.com', isPrimary: true },
    ]
    expect(extractPrimaryPhone(contacts)).toBeNull()
  })

  it('only matches PHONE type', () => {
    const contacts: MinimalContactPoint[] = [
      { type: 'PHONE', value: '6125551234', isPrimary: true },
    ]
    expect(extractPrimaryPhone(contacts)).toBe('6125551234')
  })
})

describe('extractContactInfo', () => {
  it('returns both email and phone when both exist', () => {
    const contacts: MinimalContactPoint[] = [
      { type: 'EMAIL', value: 'test@example.com', isPrimary: true },
      { type: 'PHONE', value: '6125551234', isPrimary: true },
    ]
    expect(extractContactInfo(contacts)).toEqual({
      email: 'test@example.com',
      phone: '6125551234',
    })
  })

  it('returns nulls for empty array', () => {
    expect(extractContactInfo([])).toEqual({ email: null, phone: null })
  })

  it('returns null for missing type', () => {
    const contacts: MinimalContactPoint[] = [
      { type: 'EMAIL', value: 'test@example.com', isPrimary: true },
    ]
    expect(extractContactInfo(contacts)).toEqual({
      email: 'test@example.com',
      phone: null,
    })
  })
})
