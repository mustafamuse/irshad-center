import { Shift } from '@prisma/client'

export const SCHOOL_TIMEZONE = 'America/Chicago'

export const SHIFT_START_TIMES: Record<
  Shift,
  { hour: number; minute: number }
> = {
  MORNING: { hour: 8, minute: 45 },
  AFTERNOON: { hour: 14, minute: 15 },
} as const

export const SHIFT_TIME_LABELS: Record<Shift, string> = {
  MORNING: '8:45 AM',
  AFTERNOON: '2:15 PM',
} as const

export const CHECKIN_STATUS_BADGES = {
  ON_TIME: {
    className: 'bg-green-100 text-green-800 hover:bg-green-100',
    label: 'On Time',
  },
  LATE: {
    className: 'bg-orange-100 text-orange-800 hover:bg-orange-100',
    label: 'Late',
  },
  CHECKED_IN: {
    className: 'bg-green-100 text-green-800 hover:bg-green-100',
    label: 'Checked In',
  },
  NOT_CHECKED_IN: {
    className: 'bg-gray-100 text-gray-500 hover:bg-gray-100',
    label: 'Not Checked In',
  },
  CLOCKED_OUT: {
    className: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
    label: 'Clocked Out',
  },
} as const

export const LOCATION_STATUS_BADGES = {
  VALID: {
    className: 'bg-green-100 text-green-800 hover:bg-green-100',
    label: 'Valid Location',
  },
  INVALID: {
    className: 'bg-red-100 text-red-800 hover:bg-red-100',
    label: 'Invalid Location',
  },
  UNKNOWN: {
    className: 'bg-gray-100 text-gray-500 hover:bg-gray-100',
    label: 'No Location',
  },
} as const

export const CHECK_IN_WINDOW_BEFORE_MINUTES = 30
export const CHECK_IN_WINDOW_AFTER_MINUTES = 90

export type CheckinWindowStatus = 'before' | 'open' | 'closed'

function formatHourMinute(h: number, m: number): string {
  const ampm = h >= 12 ? 'PM' : 'AM'
  const displayHour = h % 12 || 12
  return `${displayHour}:${m.toString().padStart(2, '0')} ${ampm}`
}

export function getCheckinWindowTimes(shift: Shift): {
  open: string
  close: string
} {
  const { hour, minute } = SHIFT_START_TIMES[shift]

  const openDate = new Date(2000, 0, 1, hour, minute)
  openDate.setMinutes(openDate.getMinutes() - CHECK_IN_WINDOW_BEFORE_MINUTES)

  const closeDate = new Date(2000, 0, 1, hour, minute)
  closeDate.setMinutes(closeDate.getMinutes() + CHECK_IN_WINDOW_AFTER_MINUTES)

  return {
    open: formatHourMinute(openDate.getHours(), openDate.getMinutes()),
    close: formatHourMinute(closeDate.getHours(), closeDate.getMinutes()),
  }
}

export const CHECKIN_ERROR_CODES = {
  TEACHER_NOT_FOUND: 'TEACHER_NOT_FOUND',
  NOT_ENROLLED_IN_DUGSI: 'NOT_ENROLLED_IN_DUGSI',
  INVALID_SHIFT: 'INVALID_SHIFT',
  DUPLICATE_CHECKIN: 'DUPLICATE_CHECKIN',
  CHECKIN_NOT_FOUND: 'CHECKIN_NOT_FOUND',
  ALREADY_CLOCKED_OUT: 'ALREADY_CLOCKED_OUT',
  GPS_REQUIRED: 'GPS_REQUIRED',
  SYSTEM_NOT_CONFIGURED: 'SYSTEM_NOT_CONFIGURED',
  OUTSIDE_GEOFENCE: 'OUTSIDE_GEOFENCE',
  INVALID_TIME_ORDER: 'INVALID_TIME_ORDER',
  CHECKIN_WINDOW_CLOSED: 'CHECKIN_WINDOW_CLOSED',
} as const
