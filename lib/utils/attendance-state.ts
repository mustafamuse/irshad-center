import type { Shift, TeacherAttendanceStatus } from '@prisma/client'

import { evaluateCheckIn } from '@/lib/utils/evaluate-checkin'

/**
 * Derive the correct minutesLate value for an attendance write.
 *
 * Rules:
 *  - Non-LATE status → always null (status determines semantic, not clock arithmetic)
 *  - LATE + source 'AUTO_MARKED' → null (cron fires hours after class; offset is meaningless)
 *  - LATE + missing clockInTime or shift → null (cannot compute)
 *  - LATE + valid clockInTime + shift → computed from deadline delta
 */
export function deriveMinutesLate(params: {
  toStatus: TeacherAttendanceStatus
  clockInTimeUtc?: Date | null
  shift?: Shift
  source?: 'AUTO_MARKED' | 'other'
}): number | null {
  const { toStatus, clockInTimeUtc, shift, source } = params
  if (toStatus !== 'LATE') return null
  if (source === 'AUTO_MARKED') return null
  if (!clockInTimeUtc || !shift) return null
  return evaluateCheckIn({ clockInTimeUtc, shift }).minutesLate
}
