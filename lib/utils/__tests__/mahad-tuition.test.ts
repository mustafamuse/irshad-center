/**
 * Mahad Tuition Rate Calculation Tests
 *
 * Tests for calculateMahadRate() and related utility functions
 */

import { describe, it, expect } from 'vitest'

import {
  calculateMahadRate,
  getStripeInterval,
  shouldCreateSubscription,
  formatRate,
  getBillingTypeDescription,
  BASE_RATES,
  SCHOLARSHIP_DISCOUNT,
} from '../mahad-tuition'

describe('calculateMahadRate', () => {
  describe('Non-Graduate rates', () => {
    it('returns $120 (12000 cents) for NON_GRADUATE + MONTHLY + FULL_TIME', () => {
      expect(calculateMahadRate('NON_GRADUATE', 'MONTHLY', 'FULL_TIME')).toBe(
        12000
      )
    })

    it('returns $220 (22000 cents) for NON_GRADUATE + BI_MONTHLY + FULL_TIME', () => {
      // Bi-monthly: $110/month * 2 months = $220
      expect(
        calculateMahadRate('NON_GRADUATE', 'BI_MONTHLY', 'FULL_TIME')
      ).toBe(22000)
    })

    it('returns $90 (9000 cents) for NON_GRADUATE + MONTHLY + FULL_TIME_SCHOLARSHIP', () => {
      // $120 - $30 scholarship = $90
      expect(
        calculateMahadRate('NON_GRADUATE', 'MONTHLY', 'FULL_TIME_SCHOLARSHIP')
      ).toBe(9000)
    })

    it('returns $160 (16000 cents) for NON_GRADUATE + BI_MONTHLY + FULL_TIME_SCHOLARSHIP', () => {
      // ($110 - $30) * 2 = $160
      expect(
        calculateMahadRate(
          'NON_GRADUATE',
          'BI_MONTHLY',
          'FULL_TIME_SCHOLARSHIP'
        )
      ).toBe(16000)
    })

    it('returns $60 (6000 cents) for NON_GRADUATE + MONTHLY + PART_TIME', () => {
      // $120 / 2 = $60
      expect(calculateMahadRate('NON_GRADUATE', 'MONTHLY', 'PART_TIME')).toBe(
        6000
      )
    })

    it('returns $110 (11000 cents) for NON_GRADUATE + BI_MONTHLY + PART_TIME', () => {
      // ($110 / 2) * 2 = $110
      expect(
        calculateMahadRate('NON_GRADUATE', 'BI_MONTHLY', 'PART_TIME')
      ).toBe(11000)
    })

    it('returns 0 for NON_GRADUATE + MONTHLY + EXEMPT', () => {
      expect(calculateMahadRate('NON_GRADUATE', 'MONTHLY', 'EXEMPT')).toBe(0)
    })

    it('returns 0 for NON_GRADUATE + BI_MONTHLY + EXEMPT', () => {
      expect(calculateMahadRate('NON_GRADUATE', 'BI_MONTHLY', 'EXEMPT')).toBe(0)
    })
  })

  describe('Graduate rates', () => {
    it('returns $95 (9500 cents) for GRADUATE + MONTHLY + FULL_TIME', () => {
      expect(calculateMahadRate('GRADUATE', 'MONTHLY', 'FULL_TIME')).toBe(9500)
    })

    it('returns $180 (18000 cents) for GRADUATE + BI_MONTHLY + FULL_TIME', () => {
      // Bi-monthly: $90/month * 2 months = $180
      expect(calculateMahadRate('GRADUATE', 'BI_MONTHLY', 'FULL_TIME')).toBe(
        18000
      )
    })

    it('returns $65 (6500 cents) for GRADUATE + MONTHLY + FULL_TIME_SCHOLARSHIP', () => {
      // $95 - $30 scholarship = $65
      expect(
        calculateMahadRate('GRADUATE', 'MONTHLY', 'FULL_TIME_SCHOLARSHIP')
      ).toBe(6500)
    })

    it('returns $120 (12000 cents) for GRADUATE + BI_MONTHLY + FULL_TIME_SCHOLARSHIP', () => {
      // ($90 - $30) * 2 = $120
      expect(
        calculateMahadRate('GRADUATE', 'BI_MONTHLY', 'FULL_TIME_SCHOLARSHIP')
      ).toBe(12000)
    })

    it('returns $47 (4750 cents) for GRADUATE + MONTHLY + PART_TIME (rounds down)', () => {
      // $95 / 2 = $47.50, rounds down to 4750 cents
      expect(calculateMahadRate('GRADUATE', 'MONTHLY', 'PART_TIME')).toBe(4750)
    })

    it('returns $90 (9000 cents) for GRADUATE + BI_MONTHLY + PART_TIME', () => {
      // ($90 / 2) * 2 = $90
      expect(calculateMahadRate('GRADUATE', 'BI_MONTHLY', 'PART_TIME')).toBe(
        9000
      )
    })

    it('returns 0 for GRADUATE + MONTHLY + EXEMPT', () => {
      expect(calculateMahadRate('GRADUATE', 'MONTHLY', 'EXEMPT')).toBe(0)
    })

    it('returns 0 for GRADUATE + BI_MONTHLY + EXEMPT', () => {
      expect(calculateMahadRate('GRADUATE', 'BI_MONTHLY', 'EXEMPT')).toBe(0)
    })
  })

  describe('Null/default handling', () => {
    it('returns 0 for null billing type', () => {
      expect(calculateMahadRate('NON_GRADUATE', 'MONTHLY', null)).toBe(0)
    })

    it('defaults to NON_GRADUATE when graduation status is null', () => {
      expect(calculateMahadRate(null, 'MONTHLY', 'FULL_TIME')).toBe(12000)
    })

    it('defaults to MONTHLY when payment frequency is null', () => {
      expect(calculateMahadRate('GRADUATE', null, 'FULL_TIME')).toBe(9500)
    })

    it('handles all nulls correctly', () => {
      // null billing type returns 0 regardless of other params
      expect(calculateMahadRate(null, null, null)).toBe(0)
    })

    it('uses defaults for null graduation status and frequency', () => {
      // Should default to NON_GRADUATE + MONTHLY
      expect(calculateMahadRate(null, null, 'FULL_TIME')).toBe(12000)
    })
  })

  describe('Base rate constants validation', () => {
    it('has correct NON_GRADUATE MONTHLY base rate', () => {
      expect(BASE_RATES.NON_GRADUATE.MONTHLY).toBe(12000)
    })

    it('has correct NON_GRADUATE BI_MONTHLY base rate', () => {
      expect(BASE_RATES.NON_GRADUATE.BI_MONTHLY).toBe(11000)
    })

    it('has correct GRADUATE MONTHLY base rate', () => {
      expect(BASE_RATES.GRADUATE.MONTHLY).toBe(9500)
    })

    it('has correct GRADUATE BI_MONTHLY base rate', () => {
      expect(BASE_RATES.GRADUATE.BI_MONTHLY).toBe(9000)
    })

    it('has correct scholarship discount', () => {
      expect(SCHOLARSHIP_DISCOUNT).toBe(3000)
    })
  })
})

describe('getStripeInterval', () => {
  it('returns monthly interval for MONTHLY frequency', () => {
    expect(getStripeInterval('MONTHLY')).toEqual({
      interval: 'month',
      interval_count: 1,
    })
  })

  it('returns 2-month interval for BI_MONTHLY frequency', () => {
    expect(getStripeInterval('BI_MONTHLY')).toEqual({
      interval: 'month',
      interval_count: 2,
    })
  })
})

describe('shouldCreateSubscription', () => {
  it('returns true for FULL_TIME', () => {
    expect(shouldCreateSubscription('FULL_TIME')).toBe(true)
  })

  it('returns true for FULL_TIME_SCHOLARSHIP', () => {
    expect(shouldCreateSubscription('FULL_TIME_SCHOLARSHIP')).toBe(true)
  })

  it('returns true for PART_TIME', () => {
    expect(shouldCreateSubscription('PART_TIME')).toBe(true)
  })

  it('returns false for EXEMPT', () => {
    expect(shouldCreateSubscription('EXEMPT')).toBe(false)
  })
})

describe('formatRate', () => {
  it('formats 12000 cents as $120.00', () => {
    expect(formatRate(12000)).toBe('$120.00')
  })

  it('formats 9500 cents as $95.00', () => {
    expect(formatRate(9500)).toBe('$95.00')
  })

  it('formats 0 cents as $0.00', () => {
    expect(formatRate(0)).toBe('$0.00')
  })

  it('formats 4750 cents as $47.50', () => {
    expect(formatRate(4750)).toBe('$47.50')
  })

  it('formats 22000 cents as $220.00', () => {
    expect(formatRate(22000)).toBe('$220.00')
  })
})

describe('getBillingTypeDescription', () => {
  it('returns correct description for FULL_TIME', () => {
    expect(getBillingTypeDescription('FULL_TIME')).toBe('Full-time student')
  })

  it('returns correct description for FULL_TIME_SCHOLARSHIP', () => {
    expect(getBillingTypeDescription('FULL_TIME_SCHOLARSHIP')).toBe(
      'Full-time with scholarship ($30 discount)'
    )
  })

  it('returns correct description for PART_TIME', () => {
    expect(getBillingTypeDescription('PART_TIME')).toBe(
      'Part-time student (50% rate)'
    )
  })

  it('returns correct description for EXEMPT', () => {
    expect(getBillingTypeDescription('EXEMPT')).toBe(
      'Exempt from payment (TA, staff, etc.)'
    )
  })
})
