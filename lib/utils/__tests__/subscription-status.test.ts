/**
 * Subscription Status Utility Tests
 *
 * Tests for subscription status display and formatting helpers
 */

import { describe, it, expect } from 'vitest'

import { formatPeriodRange } from '../subscription-status'

describe('formatPeriodRange', () => {
  it('should format period range as "Jan 1 - Jan 31"', () => {
    const start = new Date('2025-01-01')
    const end = new Date('2025-01-31')
    const result = formatPeriodRange(start, end)
    expect(result).toContain('Jan')
    expect(result).toContain('1')
    expect(result).toContain('31')
  })

  it('should return "—" for null start date', () => {
    const result = formatPeriodRange(null, new Date())
    expect(result).toBe('—')
  })

  it('should return "—" for null end date', () => {
    const result = formatPeriodRange(new Date(), null)
    expect(result).toBe('—')
  })

  it('should return "—" for both null dates', () => {
    const result = formatPeriodRange(null, null)
    expect(result).toBe('—')
  })

  it('should return "—" for undefined start date', () => {
    const result = formatPeriodRange(undefined, new Date())
    expect(result).toBe('—')
  })

  it('should return "—" for undefined end date', () => {
    const result = formatPeriodRange(new Date(), undefined)
    expect(result).toBe('—')
  })

  it('should handle date strings', () => {
    const start = '2025-01-01'
    const end = '2025-01-31'
    const result = formatPeriodRange(start, end)
    expect(result).toContain('Jan')
    expect(result).toContain('1')
    expect(result).toContain('31')
  })

  it('should handle ISO date strings', () => {
    const start = '2025-01-01T00:00:00.000Z'
    const end = '2025-01-31T23:59:59.999Z'
    const result = formatPeriodRange(start, end)
    expect(result).toContain('Jan')
  })

  it('should format dates across different months', () => {
    const start = new Date('2025-01-15')
    const end = new Date('2025-02-14')
    const result = formatPeriodRange(start, end)
    expect(result).toContain('Jan')
    expect(result).toContain('Feb')
  })

  it('should format dates across different years', () => {
    const start = new Date('2024-12-15')
    const end = new Date('2025-01-14')
    const result = formatPeriodRange(start, end)
    expect(result).toContain('Dec')
    expect(result).toContain('Jan')
  })
})
