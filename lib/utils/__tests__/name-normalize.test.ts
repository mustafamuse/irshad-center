import { describe, expect, it } from 'vitest'

import { extractFirstName, normalizeName } from '../name-normalize'

describe('extractFirstName', () => {
  it('returns the first whitespace-delimited token', () => {
    expect(extractFirstName('Abdi Hassan')).toBe('Abdi')
    expect(extractFirstName('Mohammed Nur Ali')).toBe('Mohammed')
  })

  it('trims and collapses whitespace', () => {
    expect(extractFirstName('  Mohammed   Ali  ')).toBe('Mohammed')
  })

  it('returns empty string for blank input', () => {
    expect(extractFirstName('')).toBe('')
    expect(extractFirstName('   ')).toBe('')
  })

  it('preserves casing of the original token', () => {
    expect(extractFirstName('mohammed ali')).toBe('mohammed')
    expect(extractFirstName('Móhamméd Ali')).toBe('Móhamméd')
  })
})

describe('normalizeName', () => {
  it('lowercases input', () => {
    expect(normalizeName('Abdi Hassan')).toBe('abdi hassan')
    expect(normalizeName('ABDI HASSAN')).toBe('abdi hassan')
  })

  it('trims and collapses whitespace', () => {
    expect(normalizeName('  Abdi   Hassan  ')).toBe('abdi hassan')
    expect(normalizeName('Abdi\tHassan')).toBe('abdi hassan')
  })

  it('strips diacritics', () => {
    expect(normalizeName('Móhamméd Áli')).toBe('mohamed ali')
    expect(normalizeName('Fátima Hüssein')).toBe('fatima hussein')
    expect(normalizeName('Ayşe')).toBe('ayse')
  })

  it('aliases Mohammed/Muhammad/Mohamed variants', () => {
    expect(normalizeName('Mohammed Ali')).toBe('mohamed ali')
    expect(normalizeName('Muhammad Ali')).toBe('mohamed ali')
    expect(normalizeName('Mohamed Ali')).toBe('mohamed ali')
    expect(normalizeName('Mohamad Ali')).toBe('mohamed ali')
    expect(normalizeName('Mohammad Ali')).toBe('mohamed ali')
  })

  it('aliases Yusuf variants', () => {
    expect(normalizeName('Yusuf Omar')).toBe('yusuf omar')
    expect(normalizeName('Yousuf Omar')).toBe('yusuf omar')
    expect(normalizeName('Yousef Omar')).toBe('yusuf omar')
  })

  it('aliases Aisha variants', () => {
    expect(normalizeName('Aisha Hassan')).toBe('aisha hassan')
    expect(normalizeName('Ayesha Hassan')).toBe('aisha hassan')
    expect(normalizeName('Aaisha Hassan')).toBe('aisha hassan')
    expect(normalizeName('Aishah Hassan')).toBe('aisha hassan')
  })

  it('aliases Hussein variants', () => {
    expect(normalizeName('Hussein Ali')).toBe('hussein ali')
    expect(normalizeName('Hussain Ali')).toBe('hussein ali')
    expect(normalizeName('Husayn Ali')).toBe('hussein ali')
  })

  it('handles empty and whitespace-only input', () => {
    expect(normalizeName('')).toBe('')
    expect(normalizeName('   ')).toBe('')
  })

  it('preserves single-token names', () => {
    expect(normalizeName('Mohammed')).toBe('mohamed')
    expect(normalizeName('Fátima')).toBe('fatima')
  })

  it('combines diacritic stripping with aliasing', () => {
    expect(normalizeName('Mohámméd Hüssein')).toBe('mohamed hussein')
  })

  it('passes through tokens without alias mappings', () => {
    expect(normalizeName('Abdi Nur Hassan')).toBe('abdi nur hassan')
  })
})
