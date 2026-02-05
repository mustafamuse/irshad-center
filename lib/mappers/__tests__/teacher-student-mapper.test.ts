import { DugsiAttendanceStatus } from '@prisma/client'
import { describe, expect, it } from 'vitest'

import {
  computeCurrentStreak,
  groupRecordsByWeekend,
} from '../teacher-student-mapper'

describe('computeCurrentStreak', () => {
  it('all PRESENT returns count', () => {
    const records = [
      { status: DugsiAttendanceStatus.PRESENT, date: new Date('2025-01-04') },
      { status: DugsiAttendanceStatus.PRESENT, date: new Date('2025-01-03') },
      { status: DugsiAttendanceStatus.PRESENT, date: new Date('2025-01-02') },
    ]
    expect(computeCurrentStreak(records)).toBe(3)
  })

  it('PRESENT then ABSENT gives streak 1', () => {
    const records = [
      { status: DugsiAttendanceStatus.PRESENT, date: new Date('2025-01-04') },
      { status: DugsiAttendanceStatus.ABSENT, date: new Date('2025-01-03') },
    ]
    expect(computeCurrentStreak(records)).toBe(1)
  })

  it('LATE counts as present', () => {
    const records = [
      { status: DugsiAttendanceStatus.LATE, date: new Date('2025-01-04') },
      { status: DugsiAttendanceStatus.PRESENT, date: new Date('2025-01-03') },
    ]
    expect(computeCurrentStreak(records)).toBe(2)
  })

  it('EXCUSED is skipped', () => {
    const records = [
      { status: DugsiAttendanceStatus.PRESENT, date: new Date('2025-01-04') },
      { status: DugsiAttendanceStatus.EXCUSED, date: new Date('2025-01-03') },
      { status: DugsiAttendanceStatus.PRESENT, date: new Date('2025-01-02') },
    ]
    expect(computeCurrentStreak(records)).toBe(2)
  })

  it('ABSENT breaks streak', () => {
    const records = [
      { status: DugsiAttendanceStatus.ABSENT, date: new Date('2025-01-04') },
      { status: DugsiAttendanceStatus.PRESENT, date: new Date('2025-01-03') },
    ]
    expect(computeCurrentStreak(records)).toBe(0)
  })

  it('empty records returns 0', () => {
    expect(computeCurrentStreak([])).toBe(0)
  })

  it('starts with ABSENT returns 0', () => {
    const records = [
      { status: DugsiAttendanceStatus.ABSENT, date: new Date('2025-01-04') },
    ]
    expect(computeCurrentStreak(records)).toBe(0)
  })
})

describe('groupRecordsByWeekend', () => {
  it('groups Saturday + Sunday into same weekend', () => {
    const records = [
      { date: new Date(2025, 0, 4), status: DugsiAttendanceStatus.PRESENT }, // Saturday
      { date: new Date(2025, 0, 5), status: DugsiAttendanceStatus.PRESENT }, // Sunday
    ]
    const result = groupRecordsByWeekend(records)
    expect(result.length).toBe(1)
    expect(result[0].total).toBe(2)
    expect(result[0].rate).toBe(100)
  })

  it('calculates rate per weekend', () => {
    const records = [
      { date: new Date(2025, 0, 4), status: DugsiAttendanceStatus.PRESENT },
      { date: new Date(2025, 0, 5), status: DugsiAttendanceStatus.ABSENT },
    ]
    const result = groupRecordsByWeekend(records)
    expect(result[0].rate).toBe(50)
  })

  it('sorts chronologically', () => {
    const records = [
      { date: new Date(2025, 0, 11), status: DugsiAttendanceStatus.PRESENT },
      { date: new Date(2025, 0, 4), status: DugsiAttendanceStatus.PRESENT },
    ]
    const result = groupRecordsByWeekend(records)
    expect(result.length).toBe(2)
    expect(result[0].weekLabel).toContain('4')
    expect(result[1].weekLabel).toContain('11')
  })

  it('filters non-weekend records', () => {
    const records = [
      { date: new Date(2025, 0, 6), status: DugsiAttendanceStatus.PRESENT }, // Monday
    ]
    expect(groupRecordsByWeekend(records)).toEqual([])
  })

  it('empty records returns empty array', () => {
    expect(groupRecordsByWeekend([])).toEqual([])
  })

  it('LATE counts as present in rate', () => {
    const records = [
      { date: new Date(2025, 0, 4), status: DugsiAttendanceStatus.LATE },
    ]
    const result = groupRecordsByWeekend(records)
    expect(result[0].rate).toBe(100)
  })
})
