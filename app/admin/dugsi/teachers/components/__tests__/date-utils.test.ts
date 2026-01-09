import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import {
  getWeekendDates,
  generateWeekendDayOptions,
  formatCheckinDate,
  formatCheckinTime,
  getQuarterRange,
  getAvailableQuarters,
} from '../date-utils'

describe('formatCheckinDate', () => {
  it('formats UTC date correctly regardless of local timezone', () => {
    const date = new Date('2025-12-27T00:00:00Z')
    expect(formatCheckinDate(date)).toBe('Sat, Dec 27')
  })

  it('handles date at midnight UTC for Saturday', () => {
    const date = new Date('2026-01-03T00:00:00Z')
    expect(formatCheckinDate(date)).toBe('Sat, Jan 3')
  })

  it('handles date at midnight UTC for Sunday', () => {
    const date = new Date('2026-01-04T00:00:00Z')
    expect(formatCheckinDate(date)).toBe('Sun, Jan 4')
  })

  it('handles date at midnight UTC for Friday', () => {
    const date = new Date('2025-12-26T00:00:00Z')
    expect(formatCheckinDate(date)).toBe('Fri, Dec 26')
  })
})

describe('getWeekendDates', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns Saturday and Sunday for weeksAgo=0 when today is Friday', () => {
    vi.setSystemTime(new Date('2026-01-09T12:00:00Z'))

    const { start, end } = getWeekendDates(0)

    expect(start.getUTCDay()).toBe(6)
    expect(end.getUTCDay()).toBe(0)
    expect(start.getUTCDate()).toBe(3)
    expect(end.getUTCDate()).toBe(4)
  })

  it('returns previous weekend for weeksAgo=1', () => {
    vi.setSystemTime(new Date('2026-01-09T12:00:00Z'))

    const { start, end } = getWeekendDates(1)

    expect(start.getUTCDate()).toBe(27)
    expect(start.getUTCMonth()).toBe(11)
    expect(end.getUTCDate()).toBe(28)
    expect(end.getUTCMonth()).toBe(11)
  })

  it('returns correct dates when today is Saturday', () => {
    vi.setSystemTime(new Date('2026-01-03T12:00:00Z'))

    const { start, end } = getWeekendDates(0)

    expect(start.getUTCDate()).toBe(3)
    expect(end.getUTCDate()).toBe(4)
  })

  it('returns correct dates when today is Sunday', () => {
    vi.setSystemTime(new Date('2026-01-04T12:00:00Z'))

    const { start, end } = getWeekendDates(0)

    expect(start.getUTCDate()).toBe(3)
    expect(end.getUTCDate()).toBe(4)
  })
})

describe('generateWeekendDayOptions', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('generates correct number of options (1 This Weekend + count*2 individual days)', () => {
    vi.setSystemTime(new Date('2026-01-09T12:00:00Z'))

    const options = generateWeekendDayOptions(4)

    expect(options).toHaveLength(9)
  })

  it('first option is Last Weekend on weekdays', () => {
    vi.setSystemTime(new Date('2026-01-09T12:00:00Z'))

    const options = generateWeekendDayOptions(4)

    expect(options[0].value).toBe('this-weekend')
    expect(options[0].label).toContain('Last Weekend')
    expect(options[0].date.getDate()).toBe(3)
    expect(options[0].endDate?.getDate()).toBe(4)
  })

  it('uses Last Sat/Sun on weekdays for most recent weekend', () => {
    vi.setSystemTime(new Date('2026-01-09T12:00:00Z'))

    const options = generateWeekendDayOptions(4)

    expect(options[1].label).toContain('Last Sat')
    expect(options[2].label).toContain('Last Sun')
    expect(options[3].label).toContain('Sat Dec')
    expect(options[4].label).toContain('Sun Dec')
  })

  it('uses This Sat/Sun on weekends', () => {
    vi.setSystemTime(new Date('2026-01-03T12:00:00Z'))

    const options = generateWeekendDayOptions(4)

    expect(options[0].label).toContain('This Weekend')
    expect(options[1].label).toContain('This Sat')
    expect(options[2].label).toContain('This Sun')
    expect(options[3].label).toContain('Last Sat')
    expect(options[4].label).toContain('Last Sun')
  })

  it('option date matches the label date', () => {
    vi.setSystemTime(new Date('2026-01-09T12:00:00Z'))

    const options = generateWeekendDayOptions(4)

    expect(options[1].label).toContain('Jan 3')
    expect(options[1].date.getDate()).toBe(3)
    expect(options[2].label).toContain('Jan 4')
    expect(options[2].date.getDate()).toBe(4)
  })
})

describe('formatCheckinTime', () => {
  it('formats morning time correctly', () => {
    const date = new Date('2026-01-09T08:30:00')
    expect(formatCheckinTime(date)).toBe('8:30 AM')
  })

  it('formats afternoon time correctly', () => {
    const date = new Date('2026-01-09T14:15:00')
    expect(formatCheckinTime(date)).toBe('2:15 PM')
  })

  it('formats noon correctly', () => {
    const date = new Date('2026-01-09T12:00:00')
    expect(formatCheckinTime(date)).toBe('12:00 PM')
  })

  it('formats midnight correctly', () => {
    const date = new Date('2026-01-09T00:00:00')
    expect(formatCheckinTime(date)).toBe('12:00 AM')
  })
})

describe('getQuarterRange', () => {
  it('returns correct dates for Q1', () => {
    const { start, end } = getQuarterRange(2026, 1)

    expect(start.getFullYear()).toBe(2026)
    expect(start.getMonth()).toBe(0)
    expect(start.getDate()).toBe(1)

    expect(end.getFullYear()).toBe(2026)
    expect(end.getMonth()).toBe(2)
    expect(end.getDate()).toBe(31)
  })

  it('returns correct dates for Q2', () => {
    const { start, end } = getQuarterRange(2026, 2)

    expect(start.getMonth()).toBe(3)
    expect(start.getDate()).toBe(1)

    expect(end.getMonth()).toBe(5)
    expect(end.getDate()).toBe(30)
  })

  it('returns correct dates for Q3', () => {
    const { start, end } = getQuarterRange(2026, 3)

    expect(start.getMonth()).toBe(6)
    expect(start.getDate()).toBe(1)

    expect(end.getMonth()).toBe(8)
    expect(end.getDate()).toBe(30)
  })

  it('returns correct dates for Q4', () => {
    const { start, end } = getQuarterRange(2026, 4)

    expect(start.getMonth()).toBe(9)
    expect(start.getDate()).toBe(1)

    expect(end.getMonth()).toBe(11)
    expect(end.getDate()).toBe(31)
  })

  it('sets start time to beginning of day', () => {
    const { start } = getQuarterRange(2026, 1)

    expect(start.getHours()).toBe(0)
    expect(start.getMinutes()).toBe(0)
    expect(start.getSeconds()).toBe(0)
  })

  it('sets end time to end of day', () => {
    const { end } = getQuarterRange(2026, 1)

    expect(end.getHours()).toBe(23)
    expect(end.getMinutes()).toBe(59)
    expect(end.getSeconds()).toBe(59)
  })
})

describe('getAvailableQuarters', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('includes current quarter if more than 1 month complete', () => {
    vi.setSystemTime(new Date('2026-03-15T12:00:00Z'))

    const quarters = getAvailableQuarters()

    expect(quarters[0]).toEqual({ year: 2026, quarter: 1 })
  })

  it('excludes current quarter if only 1 month complete', () => {
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'))

    const quarters = getAvailableQuarters()

    expect(quarters[0]).not.toEqual({ year: 2026, quarter: 1 })
  })

  it('includes all quarters from previous year', () => {
    vi.setSystemTime(new Date('2026-03-15T12:00:00Z'))

    const quarters = getAvailableQuarters()
    const previousYearQuarters = quarters.filter((q) => q.year === 2025)

    expect(previousYearQuarters).toHaveLength(4)
    expect(previousYearQuarters.map((q) => q.quarter)).toEqual([4, 3, 2, 1])
  })

  it('includes completed quarters from current year', () => {
    vi.setSystemTime(new Date('2026-09-15T12:00:00Z'))

    const quarters = getAvailableQuarters()
    const currentYearQuarters = quarters.filter((q) => q.year === 2026)

    expect(currentYearQuarters.map((q) => q.quarter)).toEqual([3, 2, 1])
  })
})
