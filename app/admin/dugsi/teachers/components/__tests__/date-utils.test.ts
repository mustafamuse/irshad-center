import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import {
  getWeekendDates,
  generateWeekendDayOptions,
  formatCheckinDate,
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
