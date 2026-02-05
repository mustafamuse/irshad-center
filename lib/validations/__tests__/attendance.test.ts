import { DugsiAttendanceStatus } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'

vi.mock('date-fns-tz', () => ({
  formatInTimeZone: (date: Date, _tz: string, fmt: string) => {
    const d = new Date(date)
    if (fmt === 'i') {
      const jsDay = d.getUTCDay()
      return String(jsDay === 0 ? 7 : jsDay)
    }
    if (fmt === 'yyyy-MM-dd') {
      return d.toISOString().split('T')[0]
    }
    return ''
  },
}))

import {
  CreateSessionSchema,
  MarkAttendanceSchema,
  AttendanceFiltersSchema,
  LoadMoreHistorySchema,
} from '../attendance'

describe('CreateSessionSchema', () => {
  const validId = '00000000-0000-0000-0000-000000000001'

  it('accepts valid Saturday date', () => {
    const result = CreateSessionSchema.safeParse({
      classId: validId,
      date: '2025-01-04', // Saturday
    })
    expect(result.success).toBe(true)
  })

  it('accepts valid Sunday date', () => {
    const result = CreateSessionSchema.safeParse({
      classId: validId,
      date: '2025-01-05', // Sunday
    })
    expect(result.success).toBe(true)
  })

  it('rejects weekday', () => {
    const result = CreateSessionSchema.safeParse({
      classId: validId,
      date: '2025-01-06', // Monday
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('weekend')
    }
  })

  it('rejects notes over 500 chars', () => {
    const result = CreateSessionSchema.safeParse({
      classId: validId,
      date: '2025-01-04',
      notes: 'x'.repeat(501),
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing classId', () => {
    const result = CreateSessionSchema.safeParse({ date: '2025-01-04' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid UUID', () => {
    const result = CreateSessionSchema.safeParse({
      classId: 'not-a-uuid',
      date: '2025-01-04',
    })
    expect(result.success).toBe(false)
  })
})

describe('MarkAttendanceSchema', () => {
  const validId = '00000000-0000-0000-0000-000000000001'

  it('accepts valid records', () => {
    const result = MarkAttendanceSchema.safeParse({
      sessionId: validId,
      records: [
        {
          programProfileId: validId,
          status: DugsiAttendanceStatus.PRESENT,
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects ayatFrom without ayatTo', () => {
    const result = MarkAttendanceSchema.safeParse({
      sessionId: validId,
      records: [
        {
          programProfileId: validId,
          status: DugsiAttendanceStatus.PRESENT,
          ayatFrom: 1,
        },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('rejects ayatTo without ayatFrom', () => {
    const result = MarkAttendanceSchema.safeParse({
      sessionId: validId,
      records: [
        {
          programProfileId: validId,
          status: DugsiAttendanceStatus.PRESENT,
          ayatTo: 5,
        },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('rejects ayatFrom > ayatTo', () => {
    const result = MarkAttendanceSchema.safeParse({
      sessionId: validId,
      records: [
        {
          programProfileId: validId,
          status: DugsiAttendanceStatus.PRESENT,
          ayatFrom: 10,
          ayatTo: 5,
        },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid status enum', () => {
    const result = MarkAttendanceSchema.safeParse({
      sessionId: validId,
      records: [
        {
          programProfileId: validId,
          status: 'INVALID',
        },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('rejects notes over 500 chars', () => {
    const result = MarkAttendanceSchema.safeParse({
      sessionId: validId,
      records: [
        {
          programProfileId: validId,
          status: DugsiAttendanceStatus.PRESENT,
          notes: 'x'.repeat(501),
        },
      ],
    })
    expect(result.success).toBe(false)
  })
})

describe('AttendanceFiltersSchema', () => {
  it('defaults page=1 and limit=50', () => {
    const result = AttendanceFiltersSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(1)
      expect(result.data.limit).toBe(50)
    }
  })

  it('rejects limit > 100', () => {
    const result = AttendanceFiltersSchema.safeParse({ limit: 101 })
    expect(result.success).toBe(false)
  })

  it('rejects invalid date', () => {
    const result = AttendanceFiltersSchema.safeParse({ dateFrom: 'not-a-date' })
    expect(result.success).toBe(false)
  })
})

describe('LoadMoreHistorySchema', () => {
  const validId = '00000000-0000-0000-0000-000000000001'

  it('accepts valid input', () => {
    const result = LoadMoreHistorySchema.safeParse({
      profileId: validId,
      offset: 20,
    })
    expect(result.success).toBe(true)
  })

  it('rejects negative offset', () => {
    const result = LoadMoreHistorySchema.safeParse({
      profileId: validId,
      offset: -1,
    })
    expect(result.success).toBe(false)
  })
})
