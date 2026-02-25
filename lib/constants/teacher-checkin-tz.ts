import { Shift } from '@prisma/client'
import { fromZonedTime, toZonedTime } from 'date-fns-tz'

import {
  CHECK_IN_WINDOW_AFTER_MINUTES,
  CHECK_IN_WINDOW_BEFORE_MINUTES,
  SCHOOL_TIMEZONE,
  SHIFT_START_TIMES,
  type CheckinWindowStatus,
} from './teacher-checkin'

export function isLateForShift(clockInTime: Date, shift: Shift): boolean {
  const shiftStart = SHIFT_START_TIMES[shift]
  const zonedTime = toZonedTime(clockInTime, SCHOOL_TIMEZONE)
  const clockInHour = zonedTime.getHours()
  const clockInMinute = zonedTime.getMinutes()

  if (clockInHour > shiftStart.hour) return true
  if (clockInHour === shiftStart.hour && clockInMinute > shiftStart.minute)
    return true
  return false
}

export function getCheckinWindowStatus(shift: Shift): CheckinWindowStatus {
  const now = new Date()
  const zonedNow = toZonedTime(now, SCHOOL_TIMEZONE)
  const { hour, minute } = SHIFT_START_TIMES[shift]

  const shiftStart = fromZonedTime(
    new Date(
      zonedNow.getFullYear(),
      zonedNow.getMonth(),
      zonedNow.getDate(),
      hour,
      minute,
      0,
      0
    ),
    SCHOOL_TIMEZONE
  )
  const windowOpen = new Date(
    shiftStart.getTime() - CHECK_IN_WINDOW_BEFORE_MINUTES * 60_000
  )
  const windowClose = new Date(
    shiftStart.getTime() + CHECK_IN_WINDOW_AFTER_MINUTES * 60_000
  )

  if (now < windowOpen) return 'before'
  if (now > windowClose) return 'closed'
  return 'open'
}

export function isCheckinWindowOpen(shift: Shift): boolean {
  return getCheckinWindowStatus(shift) === 'open'
}

export function isShiftPastCutoff(shift: Shift, referenceDate?: Date): boolean {
  const ref = referenceDate ?? new Date()
  const now = new Date()
  const zonedNow = toZonedTime(now, SCHOOL_TIMEZONE)
  const refZoned = toZonedTime(ref, SCHOOL_TIMEZONE)

  const isToday =
    refZoned.getFullYear() === zonedNow.getFullYear() &&
    refZoned.getMonth() === zonedNow.getMonth() &&
    refZoned.getDate() === zonedNow.getDate()

  if (!isToday) return true

  const { hour, minute } = SHIFT_START_TIMES[shift]
  const cutoff = fromZonedTime(
    new Date(
      zonedNow.getFullYear(),
      zonedNow.getMonth(),
      zonedNow.getDate(),
      hour,
      minute + CHECK_IN_WINDOW_AFTER_MINUTES,
      0,
      0
    ),
    SCHOOL_TIMEZONE
  )

  return now >= cutoff
}
