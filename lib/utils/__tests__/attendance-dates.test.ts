import { describe, expect, it, vi, afterEach } from 'vitest'

import { getNextWeekendDate, isWeekendDay } from '../attendance-dates'

describe('getNextWeekendDate', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns a formatted string', () => {
    const result = getNextWeekendDate()
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('on a weekday returns next Saturday', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2025, 0, 6)) // Monday Jan 6 2025
    const result = getNextWeekendDate()
    expect(result).toContain('Saturday')
    expect(result).toContain('11')
  })

  it('on Saturday returns next Saturday', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2025, 0, 4)) // Saturday Jan 4 2025
    const result = getNextWeekendDate()
    expect(result).toContain('Saturday')
    expect(result).toContain('11')
  })

  it('on Sunday returns next Saturday', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2025, 0, 5)) // Sunday Jan 5 2025
    const result = getNextWeekendDate()
    expect(result).toContain('Saturday')
    expect(result).toContain('11')
  })
})

describe('isWeekendDay', () => {
  it('Saturday returns true', () => {
    expect(isWeekendDay(new Date(2025, 0, 4))).toBe(true) // Saturday
  })

  it('Sunday returns true', () => {
    expect(isWeekendDay(new Date(2025, 0, 5))).toBe(true) // Sunday
  })

  it('Monday-Friday return false', () => {
    expect(isWeekendDay(new Date(2025, 0, 6))).toBe(false) // Monday
    expect(isWeekendDay(new Date(2025, 0, 7))).toBe(false) // Tuesday
    expect(isWeekendDay(new Date(2025, 0, 8))).toBe(false) // Wednesday
    expect(isWeekendDay(new Date(2025, 0, 9))).toBe(false) // Thursday
    expect(isWeekendDay(new Date(2025, 0, 10))).toBe(false) // Friday
  })
})
