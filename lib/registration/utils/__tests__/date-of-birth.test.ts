import { describe, expect, it } from 'vitest'

import {
  getAgeInYears,
  parseDateParts,
  tryBuildDate,
} from '../date-of-birth'

describe('date-of-birth utils', () => {
  it('parses and rebuilds dates', () => {
    const date = new Date(2005, 2, 5)

    expect(parseDateParts(date)).toEqual({
      month: '3',
      day: '5',
      year: '2005',
    })
    expect(tryBuildDate('03', '05', '2005')).toEqual(date)
  })

  it('rejects invalid dates', () => {
    expect(tryBuildDate('02', '30', '2005')).toBeUndefined()
    expect(tryBuildDate('13', '01', '2005')).toBeUndefined()
    expect(tryBuildDate('03', '05', '05')).toBeUndefined()
  })

  it('computes age using calendar boundaries', () => {
    const dob = new Date(2010, 3, 16)
    const beforeBirthday = new Date(2026, 3, 15)
    const onBirthday = new Date(2026, 3, 16)

    expect(getAgeInYears(dob, beforeBirthday)).toBe(15)
    expect(getAgeInYears(dob, onBirthday)).toBe(16)
  })
})
