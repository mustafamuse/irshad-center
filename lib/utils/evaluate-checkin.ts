import type { Shift } from '@prisma/client'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'

import { SCHOOL_TIMEZONE, SHIFT_START_TIMES } from '@/lib/constants/shift-times'

// Phase 2: add deadlineLocal via toZonedTime(deadlineUtc, timezone) when display/logging needs it
export interface ShiftDeadline {
  schoolDate: string
  shift: Shift
  deadlineUtc: Date
}

export interface CheckInEvaluation {
  isLate: boolean
  /** Floored to whole minutes. May be 0 when isLate is true (< 60 s late). Always use isLate for lateness checks. */
  minutesLate: number
  deadlineUtc: Date
}

export function resolveShiftDeadline(params: {
  schoolDate: string
  shift: Shift
  timezone?: string
}): ShiftDeadline {
  const { schoolDate, shift, timezone = SCHOOL_TIMEZONE } = params
  const { hour, minute } = SHIFT_START_TIMES[shift]

  const localDateTimeStr = `${schoolDate}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`
  const deadlineUtc = fromZonedTime(localDateTimeStr, timezone)

  return { schoolDate, shift, deadlineUtc }
}

export function evaluateCheckIn(params: {
  clockInTimeUtc: Date
  shift: Shift
  timezone?: string
}): CheckInEvaluation {
  const { clockInTimeUtc, shift, timezone = SCHOOL_TIMEZONE } = params

  // schoolDate derived from clockInTimeUtc — a check-in after midnight CT
  // evaluates against the next day's deadline (accepted: real check-ins are 8–14 CT)
  const schoolDate = formatInTimeZone(clockInTimeUtc, timezone, 'yyyy-MM-dd')
  const { deadlineUtc } = resolveShiftDeadline({ schoolDate, shift, timezone })

  const diffMs = clockInTimeUtc.getTime() - deadlineUtc.getTime()
  const isLate = diffMs > 0
  const minutesLate = isLate ? Math.floor(diffMs / 60_000) : 0

  return { isLate, minutesLate, deadlineUtc }
}
