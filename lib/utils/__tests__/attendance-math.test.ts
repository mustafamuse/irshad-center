import { describe, expect, it } from 'vitest'

import {
  sortByFamilyThenName,
  aggregateStatusCounts,
  computeAttendanceRate,
} from '../attendance-math'

describe('sortByFamilyThenName', () => {
  it('groups families together', () => {
    const items = [
      { familyReferenceId: 'B', name: 'Zara' },
      { familyReferenceId: 'A', name: 'Ali' },
      { familyReferenceId: 'B', name: 'Adam' },
      { familyReferenceId: 'A', name: 'Omar' },
    ]
    sortByFamilyThenName(items)
    expect(items.map((i) => i.name)).toEqual(['Ali', 'Omar', 'Adam', 'Zara'])
  })

  it('sorts alphabetically within same family', () => {
    const items = [
      { familyReferenceId: 'A', name: 'Zara' },
      { familyReferenceId: 'A', name: 'Ali' },
    ]
    sortByFamilyThenName(items)
    expect(items.map((i) => i.name)).toEqual(['Ali', 'Zara'])
  })

  it('puts family students before non-family', () => {
    const items = [
      { familyReferenceId: null, name: 'Ali' },
      { familyReferenceId: 'A', name: 'Zara' },
    ]
    sortByFamilyThenName(items)
    expect(items.map((i) => i.name)).toEqual(['Zara', 'Ali'])
  })

  it('sorts non-family students alphabetically', () => {
    const items = [
      { familyReferenceId: null, name: 'Zara' },
      { familyReferenceId: null, name: 'Ali' },
    ]
    sortByFamilyThenName(items)
    expect(items.map((i) => i.name)).toEqual(['Ali', 'Zara'])
  })

  it('handles empty array', () => {
    const items: { familyReferenceId: string | null; name: string }[] = []
    sortByFamilyThenName(items)
    expect(items).toEqual([])
  })

  it('handles single element', () => {
    const items = [{ familyReferenceId: null, name: 'Ali' }]
    sortByFamilyThenName(items)
    expect(items).toEqual([{ familyReferenceId: null, name: 'Ali' }])
  })

  it('handles all null familyReferenceId', () => {
    const items = [
      { familyReferenceId: null, name: 'Charlie' },
      { familyReferenceId: null, name: 'Alice' },
      { familyReferenceId: null, name: 'Bob' },
    ]
    sortByFamilyThenName(items)
    expect(items.map((i) => i.name)).toEqual(['Alice', 'Bob', 'Charlie'])
  })
})

describe('aggregateStatusCounts', () => {
  it('maps status counts to record', () => {
    const input = [{ status: 'PRESENT', _count: { status: 10 } }]
    expect(aggregateStatusCounts(input)).toEqual({ PRESENT: 10 })
  })

  it('returns empty object for empty array', () => {
    expect(aggregateStatusCounts([])).toEqual({})
  })

  it('handles all four statuses', () => {
    const input = [
      { status: 'PRESENT', _count: { status: 10 } },
      { status: 'ABSENT', _count: { status: 5 } },
      { status: 'LATE', _count: { status: 3 } },
      { status: 'EXCUSED', _count: { status: 2 } },
    ]
    expect(aggregateStatusCounts(input)).toEqual({
      PRESENT: 10,
      ABSENT: 5,
      LATE: 3,
      EXCUSED: 2,
    })
  })
})

describe('computeAttendanceRate', () => {
  it('computes (present+late)/total * 100', () => {
    expect(computeAttendanceRate(10, 2, 15)).toBe(80)
  })

  it('returns 0 when total is 0', () => {
    expect(computeAttendanceRate(0, 0, 0)).toBe(0)
  })

  it('returns 100 when all present', () => {
    expect(computeAttendanceRate(10, 0, 10)).toBe(100)
  })

  it('returns 0 when all absent', () => {
    expect(computeAttendanceRate(0, 0, 10)).toBe(0)
  })
})
