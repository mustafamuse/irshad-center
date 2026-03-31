import { Shift } from '@prisma/client'
import { fromZonedTime } from 'date-fns-tz'
import { describe, it, expect } from 'vitest'

import { resolveShiftDeadline, evaluateCheckIn } from '../evaluate-checkin'

const TZ = 'America/Chicago'

function ctToUtc(localStr: string): Date {
  return fromZonedTime(localStr, TZ)
}

describe('resolveShiftDeadline', () => {
  it('should resolve MORNING deadline to 8:45 AM CT', () => {
    const result = resolveShiftDeadline({
      schoolDate: '2026-03-28',
      shift: Shift.MORNING,
    })

    expect(result.schoolDate).toBe('2026-03-28')
    expect(result.shift).toBe(Shift.MORNING)
    expect(result.deadlineUtc).toEqual(ctToUtc('2026-03-28T08:45:00'))
  })

  it('should resolve AFTERNOON deadline to 1:15 PM CT', () => {
    const result = resolveShiftDeadline({
      schoolDate: '2026-03-28',
      shift: Shift.AFTERNOON,
    })

    expect(result.deadlineUtc).toEqual(ctToUtc('2026-03-28T13:15:00'))
  })

  it('should handle DST spring-forward date (March 8, 2026)', () => {
    const result = resolveShiftDeadline({
      schoolDate: '2026-03-08',
      shift: Shift.MORNING,
    })

    expect(result.deadlineUtc).toEqual(ctToUtc('2026-03-08T08:45:00'))
  })

  it('should handle DST fall-back date (November 1, 2026)', () => {
    const result = resolveShiftDeadline({
      schoolDate: '2026-11-01',
      shift: Shift.MORNING,
    })

    expect(result.deadlineUtc).toEqual(ctToUtc('2026-11-01T08:45:00'))
  })
})

describe('evaluateCheckIn', () => {
  describe('MORNING shift (deadline 8:45 AM CT)', () => {
    it('should be on time when checking in before 8:45', () => {
      const result = evaluateCheckIn({
        clockInTimeUtc: ctToUtc('2026-03-28T08:30:00'),
        shift: Shift.MORNING,
      })

      expect(result.isLate).toBe(false)
      expect(result.minutesLate).toBe(0)
    })

    it('should be on time when checking in exactly at 8:45', () => {
      const result = evaluateCheckIn({
        clockInTimeUtc: ctToUtc('2026-03-28T08:45:00'),
        shift: Shift.MORNING,
      })

      expect(result.isLate).toBe(false)
      expect(result.minutesLate).toBe(0)
    })

    it('should be late when checking in at 8:46', () => {
      const result = evaluateCheckIn({
        clockInTimeUtc: ctToUtc('2026-03-28T08:46:00'),
        shift: Shift.MORNING,
      })

      expect(result.isLate).toBe(true)
      expect(result.minutesLate).toBe(1)
    })

    it('should be late when checking in at 9:00 (15 min late)', () => {
      const result = evaluateCheckIn({
        clockInTimeUtc: ctToUtc('2026-03-28T09:00:00'),
        shift: Shift.MORNING,
      })

      expect(result.isLate).toBe(true)
      expect(result.minutesLate).toBe(15)
    })

    it('should be on time 1 second before deadline', () => {
      const result = evaluateCheckIn({
        clockInTimeUtc: ctToUtc('2026-03-28T08:44:59'),
        shift: Shift.MORNING,
      })

      expect(result.isLate).toBe(false)
      expect(result.minutesLate).toBe(0)
    })

    it('should be late 1 second after deadline', () => {
      const result = evaluateCheckIn({
        clockInTimeUtc: ctToUtc('2026-03-28T08:45:01'),
        shift: Shift.MORNING,
      })

      expect(result.isLate).toBe(true)
      expect(result.minutesLate).toBe(0)
    })
  })

  describe('AFTERNOON shift (deadline 1:15 PM CT)', () => {
    it('should be on time when checking in before 13:15', () => {
      const result = evaluateCheckIn({
        clockInTimeUtc: ctToUtc('2026-03-28T13:00:00'),
        shift: Shift.AFTERNOON,
      })

      expect(result.isLate).toBe(false)
      expect(result.minutesLate).toBe(0)
    })

    it('should be on time when checking in exactly at 13:15', () => {
      const result = evaluateCheckIn({
        clockInTimeUtc: ctToUtc('2026-03-28T13:15:00'),
        shift: Shift.AFTERNOON,
      })

      expect(result.isLate).toBe(false)
      expect(result.minutesLate).toBe(0)
    })

    it('should be late when checking in at 13:16', () => {
      const result = evaluateCheckIn({
        clockInTimeUtc: ctToUtc('2026-03-28T13:16:00'),
        shift: Shift.AFTERNOON,
      })

      expect(result.isLate).toBe(true)
      expect(result.minutesLate).toBe(1)
    })

    it('should be late when checking in at 14:15 (60 min late)', () => {
      const result = evaluateCheckIn({
        clockInTimeUtc: ctToUtc('2026-03-28T14:15:00'),
        shift: Shift.AFTERNOON,
      })

      expect(result.isLate).toBe(true)
      expect(result.minutesLate).toBe(60)
    })
  })

  describe('deadline resolution', () => {
    it('should return correct deadlineUtc for MORNING', () => {
      const result = evaluateCheckIn({
        clockInTimeUtc: ctToUtc('2026-03-28T08:30:00'),
        shift: Shift.MORNING,
      })

      expect(result.deadlineUtc).toEqual(ctToUtc('2026-03-28T08:45:00'))
    })

    it('should return correct deadlineUtc for AFTERNOON', () => {
      const result = evaluateCheckIn({
        clockInTimeUtc: ctToUtc('2026-03-28T13:00:00'),
        shift: Shift.AFTERNOON,
      })

      expect(result.deadlineUtc).toEqual(ctToUtc('2026-03-28T13:15:00'))
    })
  })

  describe('DST handling', () => {
    it('should correctly evaluate during CDT (summer)', () => {
      const result = evaluateCheckIn({
        clockInTimeUtc: ctToUtc('2026-07-11T08:50:00'),
        shift: Shift.MORNING,
      })

      expect(result.isLate).toBe(true)
      expect(result.minutesLate).toBe(5)
    })

    it('should correctly evaluate during CST (winter)', () => {
      const result = evaluateCheckIn({
        clockInTimeUtc: ctToUtc('2026-01-10T08:50:00'),
        shift: Shift.MORNING,
      })

      expect(result.isLate).toBe(true)
      expect(result.minutesLate).toBe(5)
    })
  })
})
