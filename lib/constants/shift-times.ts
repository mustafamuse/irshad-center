import type { Shift } from '@prisma/client'

export const SCHOOL_TIMEZONE = 'America/Chicago'

export const SHIFT_START_TIMES: Record<
  Shift,
  { hour: number; minute: number }
> = {
  MORNING: { hour: 8, minute: 45 },
  AFTERNOON: { hour: 13, minute: 15 },
}

export const SHIFT_TIME_LABELS: Record<Shift, string> = {
  MORNING: '8:45 AM',
  AFTERNOON: '1:15 PM',
}
