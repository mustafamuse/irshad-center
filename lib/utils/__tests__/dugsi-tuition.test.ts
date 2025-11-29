/**
 * Dugsi Tuition Rate Calculation Tests
 *
 * Tests for calculateDugsiRate() and related utility functions
 */

import { describe, it, expect } from 'vitest'

import {
  calculateDugsiRate,
  getRateBreakdown,
  validateOverrideAmount,
  formatRate,
  formatRateDisplay,
  getRateTierDescription,
  getStripeInterval,
  DUGSI_RATES,
  MIN_RATE_PER_CHILD,
  MAX_EXPECTED_FAMILY_RATE,
} from '../dugsi-tuition'

describe('calculateDugsiRate', () => {
  describe('Tiered rate calculation', () => {
    it('returns $80 (8000 cents) for 1 child', () => {
      expect(calculateDugsiRate(1)).toBe(8000)
    })

    it('returns $160 (16000 cents) for 2 children', () => {
      expect(calculateDugsiRate(2)).toBe(16000)
    })

    it('returns $230 (23000 cents) for 3 children', () => {
      // $80 + $80 + $70 = $230
      expect(calculateDugsiRate(3)).toBe(23000)
    })

    it('returns $290 (29000 cents) for 4 children', () => {
      // $80 + $80 + $70 + $60 = $290
      expect(calculateDugsiRate(4)).toBe(29000)
    })

    it('returns $350 (35000 cents) for 5 children', () => {
      // $80 + $80 + $70 + $60 + $60 = $350
      expect(calculateDugsiRate(5)).toBe(35000)
    })

    it('returns $410 (41000 cents) for 6 children', () => {
      // $80 + $80 + $70 + $60 + $60 + $60 = $410
      expect(calculateDugsiRate(6)).toBe(41000)
    })

    it('handles 10 children correctly', () => {
      // $80*2 + $70 + $60*7 = $160 + $70 + $420 = $650
      expect(calculateDugsiRate(10)).toBe(65000)
    })
  })

  describe('Invalid input handling', () => {
    it('returns 0 for 0 children', () => {
      expect(calculateDugsiRate(0)).toBe(0)
    })

    it('returns 0 for negative children', () => {
      expect(calculateDugsiRate(-1)).toBe(0)
      expect(calculateDugsiRate(-5)).toBe(0)
    })

    it('returns 0 for non-integer children', () => {
      expect(calculateDugsiRate(1.5)).toBe(0)
      expect(calculateDugsiRate(2.7)).toBe(0)
    })
  })

  describe('Rate constants validation', () => {
    it('has correct BASE_RATE', () => {
      expect(DUGSI_RATES.BASE_RATE).toBe(8000)
    })

    it('has correct THIRD_CHILD rate', () => {
      expect(DUGSI_RATES.THIRD_CHILD).toBe(7000)
    })

    it('has correct FOURTH_PLUS rate', () => {
      expect(DUGSI_RATES.FOURTH_PLUS).toBe(6000)
    })

    it('has correct MIN_RATE_PER_CHILD', () => {
      expect(MIN_RATE_PER_CHILD).toBe(6000)
    })

    it('has correct MAX_EXPECTED_FAMILY_RATE', () => {
      expect(MAX_EXPECTED_FAMILY_RATE).toBe(65000)
    })
  })
})

describe('getRateBreakdown', () => {
  it('returns zero breakdown for 0 children', () => {
    expect(getRateBreakdown(0)).toEqual({
      firstTwo: 0,
      third: 0,
      fourthPlus: 0,
      total: 0,
    })
  })

  it('returns correct breakdown for 1 child', () => {
    expect(getRateBreakdown(1)).toEqual({
      firstTwo: 8000,
      third: 0,
      fourthPlus: 0,
      total: 8000,
    })
  })

  it('returns correct breakdown for 2 children', () => {
    expect(getRateBreakdown(2)).toEqual({
      firstTwo: 16000,
      third: 0,
      fourthPlus: 0,
      total: 16000,
    })
  })

  it('returns correct breakdown for 3 children', () => {
    expect(getRateBreakdown(3)).toEqual({
      firstTwo: 16000,
      third: 7000,
      fourthPlus: 0,
      total: 23000,
    })
  })

  it('returns correct breakdown for 5 children', () => {
    expect(getRateBreakdown(5)).toEqual({
      firstTwo: 16000, // $80 * 2
      third: 7000, // $70
      fourthPlus: 12000, // $60 * 2
      total: 35000,
    })
  })
})

describe('validateOverrideAmount', () => {
  it('returns invalid for 0 override', () => {
    const result = validateOverrideAmount(0, 2)
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('Override amount must be positive')
  })

  it('returns invalid for negative override', () => {
    const result = validateOverrideAmount(-1000, 2)
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('Override amount must be positive')
  })

  it('returns invalid for non-integer override', () => {
    const result = validateOverrideAmount(1000.5, 2)
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('Override amount must be a whole number')
  })

  it('returns valid for reasonable override', () => {
    const result = validateOverrideAmount(15000, 2) // $150 for 2 kids (normally $160)
    expect(result.valid).toBe(true)
    expect(result.reason).toBeUndefined()
  })

  it('warns for significant deviation from calculated rate', () => {
    // For 2 children, calculated is $160 (16000)
    // Override of $50 (5000) is more than 50% different
    const result = validateOverrideAmount(5000, 2)
    expect(result.valid).toBe(true)
    expect(result.reason).toContain('differs significantly')
  })

  it('warns for override exceeding max expected rate', () => {
    const result = validateOverrideAmount(100000, 5) // $1000 for 5 kids
    expect(result.valid).toBe(true)
    expect(result.reason).toContain('exceeds typical maximum')
  })
})

describe('formatRate', () => {
  it('formats 8000 cents as $80.00', () => {
    expect(formatRate(8000)).toBe('$80.00')
  })

  it('formats 23000 cents as $230.00', () => {
    expect(formatRate(23000)).toBe('$230.00')
  })

  it('formats 0 cents as $0.00', () => {
    expect(formatRate(0)).toBe('$0.00')
  })

  it('formats 35000 cents as $350.00', () => {
    expect(formatRate(35000)).toBe('$350.00')
  })
})

describe('formatRateDisplay', () => {
  it('formats rate with /month suffix', () => {
    expect(formatRateDisplay(8000)).toBe('$80.00/month')
    expect(formatRateDisplay(23000)).toBe('$230.00/month')
  })
})

describe('getRateTierDescription', () => {
  it('returns correct description for 0 children', () => {
    expect(getRateTierDescription(0)).toBe('No children enrolled')
  })

  it('returns correct description for 1 child', () => {
    expect(getRateTierDescription(1)).toBe('1 child at $80/month')
  })

  it('returns correct description for 2 children', () => {
    expect(getRateTierDescription(2)).toBe('2 children at $80/month each')
  })

  it('returns correct description for 3 children', () => {
    expect(getRateTierDescription(3)).toBe('3 children (2 at $80, 1 at $70)')
  })

  it('returns correct description for 5 children', () => {
    expect(getRateTierDescription(5)).toBe(
      '5 children (2 at $80, 1 at $70, 2 at $60)'
    )
  })
})

describe('getStripeInterval', () => {
  it('returns monthly interval', () => {
    expect(getStripeInterval()).toEqual({
      interval: 'month',
      interval_count: 1,
    })
  })
})
