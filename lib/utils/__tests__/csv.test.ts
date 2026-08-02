import { describe, it, expect } from 'vitest'

import { csvCell } from '../csv'

describe('csvCell', () => {
  it('passes through a plain value unchanged', () => {
    expect(csvCell('Ahmed Ali')).toBe('Ahmed Ali')
  })

  it('returns an empty string for null or undefined', () => {
    expect(csvCell(null)).toBe('')
    expect(csvCell(undefined)).toBe('')
  })

  it('prefixes formula-injection characters', () => {
    expect(csvCell('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)")
    expect(csvCell('+1234')).toBe("'+1234")
    expect(csvCell('-1234')).toBe("'-1234")
    expect(csvCell('@mention')).toBe("'@mention")
  })

  it('quotes and escapes values containing commas', () => {
    expect(csvCell('Ali, Hussein')).toBe('"Ali, Hussein"')
  })

  it('quotes and doubles embedded quotes', () => {
    expect(csvCell('Say "hi"')).toBe('"Say ""hi"""')
  })

  it('quotes values containing CR or LF', () => {
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"')
    expect(csvCell('line1\rline2')).toBe('"line1\rline2"')
  })
})
