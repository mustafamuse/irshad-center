import type { Shift, TeacherAttendanceStatus } from '@prisma/client'
import { describe, it, expect } from 'vitest'

import { deriveMinutesLate } from '@/lib/utils/attendance-state'

// MORNING deadline: 8:45 AM America/Chicago (CDT = UTC-5 in April)
// → 13:45:00 UTC. Five minutes late → 13:50:00 UTC.
const MORNING_5_MIN_LATE = new Date('2026-04-14T13:50:00.000Z')

describe('deriveMinutesLate', () => {
  const cases: [
    string,
    {
      toStatus: TeacherAttendanceStatus
      clockInTimeUtc?: Date | null
      shift?: Shift
      source?: 'AUTO_MARKED' | 'other'
    },
    number | null,
  ][] = [
    // Non-LATE statuses always return null regardless of other params
    [
      'PRESENT + valid clockIn + shift → null',
      {
        toStatus: 'PRESENT',
        clockInTimeUtc: MORNING_5_MIN_LATE,
        shift: 'MORNING',
      },
      null,
    ],
    ['ABSENT → null', { toStatus: 'ABSENT' }, null],
    ['EXCUSED → null', { toStatus: 'EXCUSED' }, null],
    ['EXPECTED → null', { toStatus: 'EXPECTED' }, null],
    ['CLOSED → null', { toStatus: 'CLOSED' }, null],

    // LATE — AUTO_MARKED explicitly encoded as null (cron fires hours after class)
    [
      'LATE + AUTO_MARKED → null',
      {
        toStatus: 'LATE',
        source: 'AUTO_MARKED',
        clockInTimeUtc: MORNING_5_MIN_LATE,
        shift: 'MORNING',
      },
      null,
    ],

    // LATE — missing inputs return null
    [
      'LATE + no clockInTime → null',
      { toStatus: 'LATE', shift: 'MORNING' },
      null,
    ],
    [
      'LATE + clockInTime null → null',
      { toStatus: 'LATE', clockInTimeUtc: null, shift: 'MORNING' },
      null,
    ],
    [
      'LATE + no shift → null',
      { toStatus: 'LATE', clockInTimeUtc: MORNING_5_MIN_LATE },
      null,
    ],

    // LATE — computed from deadline delta
    [
      'LATE + 5 min after MORNING deadline → 5',
      {
        toStatus: 'LATE',
        clockInTimeUtc: MORNING_5_MIN_LATE,
        shift: 'MORNING',
      },
      5,
    ],
    [
      'LATE + source other + 5 min after deadline → 5',
      {
        toStatus: 'LATE',
        clockInTimeUtc: MORNING_5_MIN_LATE,
        shift: 'MORNING',
        source: 'other',
      },
      5,
    ],
  ]

  it.each(cases)('%s', (_label, params, expected) => {
    expect(deriveMinutesLate(params)).toBe(expected)
  })
})
