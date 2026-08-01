import type { Shift } from '@prisma/client'

export const SCHOOL_TIMEZONE = 'America/Chicago'

export const SHIFT_START_TIMES = {
  MORNING: { hour: 8, minute: 45 },
  AFTERNOON: { hour: 13, minute: 15 },
} as const satisfies Record<Shift, { hour: number; minute: number }>

export const SHIFT_TIME_LABELS = {
  MORNING: '8:45 AM',
  AFTERNOON: '1:15 PM',
} as const satisfies Record<Shift, string>
