import type { Shift } from '@prisma/client'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'

import { SCHOOL_TIMEZONE, SHIFT_START_TIMES } from '@/lib/constants/teacher-checkin'

export interface ShiftDeadline {
  schoolDate: string
  shift: Shift
  deadlineLocal: Date
  deadlineUtc: Date
}

export interface CheckInEvaluation {
  isLate: boolean
  minutesLate: number
  deadlineLocal: Date
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

  const deadlineLocal = new Date(localDateTimeStr)

  return {
    schoolDate,
    shift,
    deadlineLocal,
    deadlineUtc,
  }
}

export function evaluateCheckIn(params: {
  clockInTimeUtc: Date
  shift: Shift
  timezone?: string
}): CheckInEvaluation {
  const { clockInTimeUtc, shift, timezone = SCHOOL_TIMEZONE } = params

  const schoolDate = formatInTimeZone(clockInTimeUtc, timezone, 'yyyy-MM-dd')
  const deadline = resolveShiftDeadline({ schoolDate, shift, timezone })

  const diffMs = clockInTimeUtc.getTime() - deadline.deadlineUtc.getTime()
  const isLate = diffMs > 0
  const minutesLate = isLate ? Math.floor(diffMs / 60_000) : 0

  return {
    isLate,
    minutesLate,
    deadlineLocal: deadline.deadlineLocal,
    deadlineUtc: deadline.deadlineUtc,
  }
}
