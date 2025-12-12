/**
 * Billing Date Utilities Tests
 *
 * Tests for billing start date calculations used in payment link dialogs.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import {
  formatOrdinal,
  getNextBillingDate,
  formatBillingDate,
  validateBillingCycleAnchor,
  parseBillingDay,
  getBillingDayOptions,
  MAX_BILLING_START_DAY,
  MAX_BILLING_ANCHOR_DAYS,
  BILLING_TIMEZONE,
} from '../billing-date'

describe('formatOrdinal', () => {
  it('formats 1st correctly', () => {
    expect(formatOrdinal(1)).toBe('1st')
  })

  it('formats 2nd correctly', () => {
    expect(formatOrdinal(2)).toBe('2nd')
  })

  it('formats 3rd correctly', () => {
    expect(formatOrdinal(3)).toBe('3rd')
  })

  it('formats 4th-20th with th suffix', () => {
    expect(formatOrdinal(4)).toBe('4th')
    expect(formatOrdinal(11)).toBe('11th')
    expect(formatOrdinal(12)).toBe('12th')
    expect(formatOrdinal(13)).toBe('13th')
    expect(formatOrdinal(15)).toBe('15th')
  })

  it('formats 21st, 22nd, 23rd correctly', () => {
    expect(formatOrdinal(21)).toBe('21st')
    expect(formatOrdinal(22)).toBe('22nd')
    expect(formatOrdinal(23)).toBe('23rd')
  })

  it('formats 31st correctly', () => {
    expect(formatOrdinal(31)).toBe('31st')
  })
})

describe('getNextBillingDate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns this month if day has not yet passed', () => {
    // Set current time to December 5, 2025 at noon CST
    vi.setSystemTime(new Date('2025-12-05T12:00:00-06:00'))

    const result = getNextBillingDate(10)
    // Should be December 10, 2025 at midnight CST (which is 6:00 UTC)
    expect(result.getUTCMonth()).toBe(11) // December (0-indexed)
    expect(result.getUTCDate()).toBe(10)
    expect(result.getUTCFullYear()).toBe(2025)
  })

  it('returns next month if day has already passed this month', () => {
    // Set current time to December 15, 2025 at noon CST
    vi.setSystemTime(new Date('2025-12-15T12:00:00-06:00'))

    const result = getNextBillingDate(5)
    // Should be January 5, 2026
    expect(result.getUTCMonth()).toBe(0) // January
    expect(result.getUTCDate()).toBe(5)
    expect(result.getUTCFullYear()).toBe(2026)
  })

  it('returns next month if today is the same day', () => {
    // Set current time to December 10, 2025 at noon CST
    vi.setSystemTime(new Date('2025-12-10T12:00:00-06:00'))

    const result = getNextBillingDate(10)
    // Should be January 10, 2026 (since today already started)
    expect(result.getUTCMonth()).toBe(0) // January
    expect(result.getUTCDate()).toBe(10)
    expect(result.getUTCFullYear()).toBe(2026)
  })

  it('throws error for day less than 1', () => {
    expect(() => getNextBillingDate(0)).toThrow('Invalid billing day: 0')
    expect(() => getNextBillingDate(-1)).toThrow('Invalid billing day: -1')
  })

  it('throws error for day greater than MAX_BILLING_START_DAY', () => {
    expect(() => getNextBillingDate(16)).toThrow(
      `Invalid billing day: 16. Must be integer 1-${MAX_BILLING_START_DAY}`
    )
    expect(() => getNextBillingDate(31)).toThrow(
      `Invalid billing day: 31. Must be integer 1-${MAX_BILLING_START_DAY}`
    )
  })

  it('throws error for non-integer values', () => {
    expect(() => getNextBillingDate(1.5)).toThrow('Invalid billing day: 1.5')
    expect(() => getNextBillingDate(NaN)).toThrow('Invalid billing day: NaN')
  })

  it('accepts all valid days 1-15', () => {
    vi.setSystemTime(new Date('2025-12-01T00:00:00-06:00'))

    for (let day = 1; day <= MAX_BILLING_START_DAY; day++) {
      expect(() => getNextBillingDate(day)).not.toThrow()
    }
  })
})

describe('validateBillingCycleAnchor', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('throws for timestamps in the past', () => {
    vi.setSystemTime(new Date('2025-12-10T12:00:00Z'))
    const nowSeconds = Math.floor(Date.now() / 1000)
    const pastTimestamp = nowSeconds - 3600 // 1 hour ago

    expect(() => validateBillingCycleAnchor(pastTimestamp)).toThrow(
      'Billing start date must be in the future'
    )
  })

  it('throws for current timestamp (not strictly future)', () => {
    vi.setSystemTime(new Date('2025-12-10T12:00:00Z'))
    const nowSeconds = Math.floor(Date.now() / 1000)

    expect(() => validateBillingCycleAnchor(nowSeconds)).toThrow(
      'Billing start date must be in the future'
    )
  })

  it('throws for timestamps more than 1 year away', () => {
    vi.setSystemTime(new Date('2025-12-10T12:00:00Z'))
    const nowSeconds = Math.floor(Date.now() / 1000)
    const tooFarTimestamp =
      nowSeconds + (MAX_BILLING_ANCHOR_DAYS + 1) * 24 * 60 * 60

    expect(() => validateBillingCycleAnchor(tooFarTimestamp)).toThrow(
      'Billing start date must be within 1 year'
    )
  })

  it('accepts valid future timestamps within 1 year', () => {
    vi.setSystemTime(new Date('2025-12-10T12:00:00Z'))
    const nowSeconds = Math.floor(Date.now() / 1000)

    // 1 hour in the future
    expect(() => validateBillingCycleAnchor(nowSeconds + 3600)).not.toThrow()

    // 30 days in the future
    expect(() =>
      validateBillingCycleAnchor(nowSeconds + 30 * 24 * 60 * 60)
    ).not.toThrow()

    // Just under 1 year in the future
    expect(() =>
      validateBillingCycleAnchor(nowSeconds + 364 * 24 * 60 * 60)
    ).not.toThrow()
  })

  it('accepts timestamp exactly at MAX_BILLING_ANCHOR_DAYS boundary', () => {
    vi.setSystemTime(new Date('2025-12-10T12:00:00Z'))
    const nowSeconds = Math.floor(Date.now() / 1000)
    const maxTimestamp = nowSeconds + MAX_BILLING_ANCHOR_DAYS * 24 * 60 * 60

    expect(() => validateBillingCycleAnchor(maxTimestamp)).not.toThrow()
  })
})

describe('parseBillingDay', () => {
  it('returns null for empty string', () => {
    expect(parseBillingDay('')).toBeNull()
  })

  it('returns null for undefined', () => {
    expect(parseBillingDay(undefined)).toBeNull()
  })

  it('parses valid day strings', () => {
    expect(parseBillingDay('1')).toBe(1)
    expect(parseBillingDay('5')).toBe(5)
    expect(parseBillingDay('15')).toBe(15)
  })

  it('returns null for day less than 1', () => {
    expect(parseBillingDay('0')).toBeNull()
    expect(parseBillingDay('-1')).toBeNull()
  })

  it('returns null for day greater than MAX_BILLING_START_DAY', () => {
    expect(parseBillingDay('16')).toBeNull()
    expect(parseBillingDay('31')).toBeNull()
  })

  it('returns null for non-numeric strings', () => {
    expect(parseBillingDay('abc')).toBeNull()
    expect(parseBillingDay('hello')).toBeNull()
  })

  it('truncates decimal strings (parseInt behavior)', () => {
    // parseInt('1.5') returns 1, which is valid
    // This is acceptable since Select only provides integer strings
    expect(parseBillingDay('1.5')).toBe(1)
  })
})

describe('getBillingDayOptions', () => {
  it('returns array of length MAX_BILLING_START_DAY', () => {
    const options = getBillingDayOptions()
    expect(options).toHaveLength(MAX_BILLING_START_DAY)
  })

  it('returns correctly formatted options', () => {
    const options = getBillingDayOptions()

    expect(options[0]).toEqual({ value: '1', label: '1st of the month' })
    expect(options[1]).toEqual({ value: '2', label: '2nd of the month' })
    expect(options[2]).toEqual({ value: '3', label: '3rd of the month' })
    expect(options[3]).toEqual({ value: '4', label: '4th of the month' })
    expect(options[14]).toEqual({ value: '15', label: '15th of the month' })
  })

  it('all options have string values', () => {
    const options = getBillingDayOptions()
    options.forEach((option) => {
      expect(typeof option.value).toBe('string')
      expect(typeof option.label).toBe('string')
    })
  })
})

describe('formatBillingDate', () => {
  it('formats date in US English format', () => {
    const date = new Date('2026-01-15T06:00:00Z')
    const formatted = formatBillingDate(date)
    expect(formatted).toMatch(/January 15, 2026/)
  })

  it('formats different months correctly', () => {
    expect(formatBillingDate(new Date('2026-03-05T06:00:00Z'))).toMatch(
      /March 5, 2026/
    )
    expect(formatBillingDate(new Date('2026-12-25T06:00:00Z'))).toMatch(
      /December 25, 2026/
    )
  })
})

describe('constants', () => {
  it('MAX_BILLING_START_DAY is 15', () => {
    expect(MAX_BILLING_START_DAY).toBe(15)
  })

  it('MAX_BILLING_ANCHOR_DAYS is 365', () => {
    expect(MAX_BILLING_ANCHOR_DAYS).toBe(365)
  })

  it('BILLING_TIMEZONE is America/Chicago', () => {
    expect(BILLING_TIMEZONE).toBe('America/Chicago')
  })
})
