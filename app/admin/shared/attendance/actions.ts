'use server'

import { z } from 'zod'

import { logger } from '@/lib/logger'

import { AttendanceStatus } from './_types'

/**
 * Attendance Actions
 *
 * NOTE: The attendance feature is incomplete. The database models
 * (AttendanceSession, AttendanceRecord) were removed from the schema.
 * These functions are stubbed out until the feature is implemented.
 * TODO: Implement in future PR when attendance feature is prioritized.
 */

type ActionResult<T = void> = T extends void
  ? { success: boolean; error?: string }
  : { success: true; data: T } | { success: false; error: string }

const createSessionSchema = z.object({
  batchId: z.string(),
  date: z.string(),
  notes: z.string().optional(),
})

export async function createSession(
  _input: z.infer<typeof createSessionSchema>
): Promise<ActionResult> {
  logger.warn(
    { action: 'createSession', reason: 'feature_not_implemented' },
    'Attendance feature disabled'
  )
  return {
    success: false,
    error: 'Attendance feature is not yet implemented.',
  }
}

const markAttendanceSchema = z.object({
  sessionId: z.string(),
  records: z.array(
    z.object({
      studentId: z.string(),
      status: z.nativeEnum(AttendanceStatus),
      notes: z.string().optional(),
    })
  ),
})

export async function markAttendance(
  _input: z.infer<typeof markAttendanceSchema>
): Promise<ActionResult> {
  logger.warn(
    { action: 'markAttendance', reason: 'feature_not_implemented' },
    'Attendance feature disabled'
  )
  return {
    success: false,
    error: 'Attendance feature is not yet implemented.',
  }
}

export async function deleteSession(_sessionId: string): Promise<ActionResult> {
  logger.warn(
    { action: 'deleteSession', reason: 'feature_not_implemented' },
    'Attendance feature disabled'
  )
  return {
    success: false,
    error: 'Attendance feature is not yet implemented.',
  }
}
