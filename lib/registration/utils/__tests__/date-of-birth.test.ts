import { describe, it, expect } from 'vitest'

import {
  getAgeInYears,
  parseDateParts,
  tryBuildDate,
} from '../date-of-birth'

describe('parseDateParts', () => {
  it('returns empty parts for undefined / null / non-dates', () => {
    expect(parseDateParts(undefined)).toEqual({ month: '', day: '', year: '' })
    expect(parseDateParts(null)).toEqual({ month: '', day: '', year: '' })
    expect(parseDateParts('2005-06-15')).toEqual({ month: '', day: '', year: '' })
  })

  it('returns empty parts for an Invalid Date', () => {
    expect(parseDateParts(new Date('not-a-date'))).toEqual({
      month: '',
      day: '',
      year: '',
    })
  })

  it('breaks a valid Date into string month/day/year', () => {
    expect(parseDateParts(new Date(2005, 5, 15))).toEqual({
      month: '6',
      day: '15',
      year: '2005',
    })
  })
})

describe('tryBuildDate', () => {
  it('returns undefined when any part is missing', () => {
    expect(tryBuildDate('', '15', '2005')).toBeUndefined()
    expect(tryBuildDate('6', '', '2005')).toBeUndefined()
    expect(tryBuildDate('6', '15', '')).toBeUndefined()
  })

  it('returns undefined when year has fewer than 4 digits', () => {
    expect(tryBuildDate('6', '15', '205')).toBeUndefined()
  })

  it('rejects out-of-range month or day', () => {
    expect(tryBuildDate('13', '15', '2005')).toBeUndefined()
    expect(tryBuildDate('0', '15', '2005')).toBeUndefined()
    expect(tryBuildDate('6', '32', '2005')).toBeUndefined()
    expect(tryBuildDate('6', '0', '2005')).toBeUndefined()
  })

  it('rejects invalid calendar dates (e.g. Feb 30)', () => {
    expect(tryBuildDate('2', '30', '2005')).toBeUndefined()
  })

  it('accepts leap day Feb 29 in leap years', () => {
    const result = tryBuildDate('2', '29', '2024')
    expect(result).toBeInstanceOf(Date)
    expect(result?.getFullYear()).toBe(2024)
    expect(result?.getMonth()).toBe(1)
    expect(result?.getDate()).toBe(29)
  })

  it('rejects Feb 29 in non-leap years', () => {
    expect(tryBuildDate('2', '29', '2023')).toBeUndefined()
  })

  it('returns a valid Date for well-formed input', () => {
    const result = tryBuildDate('6', '15', '2005')
    expect(result).toBeInstanceOf(Date)
    expect(result?.getFullYear()).toBe(2005)
    expect(result?.getMonth()).toBe(5)
    expect(result?.getDate()).toBe(15)
  })
})

describe('getAgeInYears', () => {
  it('returns exact age on birthday', () => {
    expect(getAgeInYears(new Date(2005, 5, 15), new Date(2025, 5, 15))).toBe(20)
  })

  it('subtracts a year when current date is before birthday this year', () => {
    expect(getAgeInYears(new Date(2005, 5, 15), new Date(2025, 5, 14))).toBe(19)
    expect(getAgeInYears(new Date(2005, 5, 15), new Date(2025, 4, 30))).toBe(19)
  })

  it('returns full age after birthday', () => {
    expect(getAgeInYears(new Date(2005, 5, 15), new Date(2025, 5, 16))).toBe(20)
    expect(getAgeInYears(new Date(2005, 5, 15), new Date(2025, 11, 31))).toBe(20)
  })

  it('handles leap-year birthdays (Feb 29)', () => {
    // Born on leap day. On Feb 28 2025 (non-leap), not yet 1 year old.
    expect(getAgeInYears(new Date(2024, 1, 29), new Date(2025, 1, 28))).toBe(0)
    // On Mar 1 2025, they have aged a full year.
    expect(getAgeInYears(new Date(2024, 1, 29), new Date(2025, 2, 1))).toBe(1)
  })

  it('defaults `now` to the current date', () => {
    const dob = new Date()
    dob.setFullYear(dob.getFullYear() - 25)
    expect(getAgeInYears(dob)).toBe(25)
  })
})
