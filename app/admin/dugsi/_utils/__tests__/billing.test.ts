/**
 * Billing Utilities Tests
 *
 * Tests for billing comparison utilities
 */

import { describe, it, expect } from 'vitest'

import { DugsiRegistration } from '../../_types'
import { hasBillingMismatch, getBillingStatus, BillingStatus } from '../billing'

describe('hasBillingMismatch', () => {
  it('returns false when no subscription', () => {
    const reg = {
      subscriptionAmount: null,
      familyChildCount: 2,
    } as DugsiRegistration
    expect(hasBillingMismatch(reg)).toBe(false)
  })

  it('returns false when amounts match exactly for 1 child', () => {
    const reg = {
      subscriptionAmount: 8000,
      familyChildCount: 1,
    } as DugsiRegistration
    expect(hasBillingMismatch(reg)).toBe(false)
  })

  it('returns false when amounts match exactly for 2 children', () => {
    const reg = {
      subscriptionAmount: 16000,
      familyChildCount: 2,
    } as DugsiRegistration
    expect(hasBillingMismatch(reg)).toBe(false)
  })

  it('returns false when amounts match exactly for 3 children', () => {
    const reg = {
      subscriptionAmount: 23000,
      familyChildCount: 3,
    } as DugsiRegistration
    expect(hasBillingMismatch(reg)).toBe(false)
  })

  it('returns false when amounts match exactly for 4 children', () => {
    const reg = {
      subscriptionAmount: 29000,
      familyChildCount: 4,
    } as DugsiRegistration
    expect(hasBillingMismatch(reg)).toBe(false)
  })

  it('returns true when underpaying', () => {
    const reg = {
      subscriptionAmount: 8000,
      familyChildCount: 2,
    } as DugsiRegistration
    expect(hasBillingMismatch(reg)).toBe(true)
  })

  it('returns true when overpaying', () => {
    const reg = {
      subscriptionAmount: 20000,
      familyChildCount: 2,
    } as DugsiRegistration
    expect(hasBillingMismatch(reg)).toBe(true)
  })

  it('handles familyChildCount of 0 by using 1 as fallback', () => {
    const reg = {
      subscriptionAmount: 8000,
      familyChildCount: 0,
    } as DugsiRegistration
    expect(hasBillingMismatch(reg)).toBe(false)
  })
})

describe('getBillingStatus', () => {
  it('returns "no-subscription" when subscriptionAmount is null', () => {
    const reg = {
      subscriptionAmount: null,
      familyChildCount: 1,
    } as DugsiRegistration
    const result = getBillingStatus(reg)
    expect(result).toEqual<BillingStatus>({
      status: 'no-subscription',
      actual: null,
      expected: 8000,
      difference: null,
    })
  })

  it('returns "match" when amounts equal for 1 child', () => {
    const reg = {
      subscriptionAmount: 8000,
      familyChildCount: 1,
    } as DugsiRegistration
    const result = getBillingStatus(reg)
    expect(result).toEqual<BillingStatus>({
      status: 'match',
      actual: 8000,
      expected: 8000,
      difference: 0,
    })
  })

  it('returns "match" when amounts equal for 2 children', () => {
    const reg = {
      subscriptionAmount: 16000,
      familyChildCount: 2,
    } as DugsiRegistration
    const result = getBillingStatus(reg)
    expect(result).toEqual<BillingStatus>({
      status: 'match',
      actual: 16000,
      expected: 16000,
      difference: 0,
    })
  })

  it('returns "underpaying" when actual < expected', () => {
    const reg = {
      subscriptionAmount: 8000,
      familyChildCount: 2,
    } as DugsiRegistration
    const result = getBillingStatus(reg)
    expect(result.status).toBe('underpaying')
    expect(result.actual).toBe(8000)
    expect(result.expected).toBe(16000)
    expect(result.difference).toBe(-8000)
  })

  it('returns "overpaying" when actual > expected', () => {
    const reg = {
      subscriptionAmount: 20000,
      familyChildCount: 2,
    } as DugsiRegistration
    const result = getBillingStatus(reg)
    expect(result.status).toBe('overpaying')
    expect(result.actual).toBe(20000)
    expect(result.expected).toBe(16000)
    expect(result.difference).toBe(4000)
  })

  it('calculates correct expected for 3 children', () => {
    const reg = {
      subscriptionAmount: 16000,
      familyChildCount: 3,
    } as DugsiRegistration
    const result = getBillingStatus(reg)
    expect(result.expected).toBe(23000)
    expect(result.status).toBe('underpaying')
    expect(result.difference).toBe(-7000)
  })

  it('calculates correct expected for 4 children', () => {
    const reg = {
      subscriptionAmount: 29000,
      familyChildCount: 4,
    } as DugsiRegistration
    const result = getBillingStatus(reg)
    expect(result.expected).toBe(29000)
    expect(result.status).toBe('match')
    expect(result.difference).toBe(0)
  })

  it('handles familyChildCount of 0 by using 1 as fallback', () => {
    const reg = {
      subscriptionAmount: 8000,
      familyChildCount: 0,
    } as DugsiRegistration
    const result = getBillingStatus(reg)
    expect(result.expected).toBe(8000)
    expect(result.status).toBe('match')
  })
})
