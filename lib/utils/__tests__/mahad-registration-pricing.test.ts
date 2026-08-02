import { describe, expect, it } from 'vitest'

import {
  formatMahadEstimate,
  formatMahadOptionPrice,
} from '../mahad-registration-pricing'

describe('formatMahadOptionPrice', () => {
  it('formats monthly rates without savings text', () => {
    expect(formatMahadOptionPrice('NON_GRADUATE', 'MONTHLY')).toBe('$120/mo')
    expect(formatMahadOptionPrice('GRADUATE', 'MONTHLY')).toBe('$95/mo')
  })

  it('formats bi-monthly as the 2-month total with per-month savings', () => {
    expect(formatMahadOptionPrice('NON_GRADUATE', 'BI_MONTHLY')).toBe(
      '$220 (save $10/mo)'
    )
    expect(formatMahadOptionPrice('GRADUATE', 'BI_MONTHLY')).toBe(
      '$180 (save $5/mo)'
    )
  })
})

describe('formatMahadEstimate', () => {
  it('returns a monthly label with no savings line', () => {
    expect(formatMahadEstimate('NON_GRADUATE', 'MONTHLY')).toEqual({
      label: 'Estimated: $120/month',
      savingsLabel: null,
    })
    expect(formatMahadEstimate('GRADUATE', 'MONTHLY')).toEqual({
      label: 'Estimated: $95/month',
      savingsLabel: null,
    })
  })

  it('returns a bi-monthly label with a per-month savings line', () => {
    expect(formatMahadEstimate('NON_GRADUATE', 'BI_MONTHLY')).toEqual({
      label: 'Estimated: $220 every 2 months',
      savingsLabel: 'Save $10/month vs monthly billing',
    })
    expect(formatMahadEstimate('GRADUATE', 'BI_MONTHLY')).toEqual({
      label: 'Estimated: $180 every 2 months',
      savingsLabel: 'Save $5/month vs monthly billing',
    })
  })
})
