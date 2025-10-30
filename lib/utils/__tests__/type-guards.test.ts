/**
 * Type Guards Tests - Period Extraction Functions
 *
 * Tests for extracting subscription period dates from Stripe subscription objects
 */

import { describe, it, expect } from 'vitest'

import { extractPeriodStart, extractPeriodDates } from '../type-guards'

describe('extractPeriodStart', () => {
  it('should extract period start from Stripe subscription', () => {
    const periodStartTimestamp = Math.floor(Date.now() / 1000)
    const subscription = {
      current_period_start: periodStartTimestamp,
      current_period_end: periodStartTimestamp + 30 * 24 * 60 * 60,
    }

    const result = extractPeriodStart(subscription)
    expect(result).toBeInstanceOf(Date)
    expect(result?.getTime()).toBe(periodStartTimestamp * 1000)
  })

  it('should return undefined for null subscription', () => {
    const result = extractPeriodStart(null)
    expect(result).toBeUndefined()
  })

  it('should return undefined for undefined subscription', () => {
    const result = extractPeriodStart(undefined)
    expect(result).toBeUndefined()
  })

  it('should return undefined for non-object input', () => {
    const result = extractPeriodStart('not an object')
    expect(result).toBeUndefined()
  })

  it('should return undefined when current_period_start is missing', () => {
    const subscription = {
      current_period_end: Math.floor(Date.now() / 1000),
    }
    const result = extractPeriodStart(subscription)
    expect(result).toBeUndefined()
  })

  it('should return undefined when current_period_start is not a number', () => {
    const subscription = {
      current_period_start: 'not a number',
      current_period_end: Math.floor(Date.now() / 1000),
    }
    const result = extractPeriodStart(subscription)
    expect(result).toBeUndefined()
  })
})

describe('extractPeriodDates', () => {
  it('should extract both period start and end from Stripe subscription', () => {
    const periodStartTimestamp = Math.floor(Date.now() / 1000)
    const periodEndTimestamp = periodStartTimestamp + 30 * 24 * 60 * 60
    const subscription = {
      current_period_start: periodStartTimestamp,
      current_period_end: periodEndTimestamp,
    }

    const result = extractPeriodDates(subscription)
    expect(result.periodStart).toBeInstanceOf(Date)
    expect(result.periodEnd).toBeInstanceOf(Date)
    expect(result.periodStart?.getTime()).toBe(periodStartTimestamp * 1000)
    expect(result.periodEnd?.getTime()).toBe(periodEndTimestamp * 1000)
  })

  it('should return undefined for both dates when subscription is null', () => {
    const result = extractPeriodDates(null)
    expect(result.periodStart).toBeUndefined()
    expect(result.periodEnd).toBeUndefined()
  })

  it('should return undefined for missing dates', () => {
    const subscription = {}
    const result = extractPeriodDates(subscription)
    expect(result.periodStart).toBeUndefined()
    expect(result.periodEnd).toBeUndefined()
  })

  it('should extract start date even if end date is missing', () => {
    const periodStartTimestamp = Math.floor(Date.now() / 1000)
    const subscription = {
      current_period_start: periodStartTimestamp,
    }

    const result = extractPeriodDates(subscription)
    expect(result.periodStart).toBeInstanceOf(Date)
    expect(result.periodEnd).toBeUndefined()
  })

  it('should extract end date even if start date is missing', () => {
    const periodEndTimestamp = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
    const subscription = {
      current_period_end: periodEndTimestamp,
    }

    const result = extractPeriodDates(subscription)
    expect(result.periodStart).toBeUndefined()
    expect(result.periodEnd).toBeInstanceOf(Date)
  })
})
