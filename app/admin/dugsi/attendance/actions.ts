'use server'

import { z } from 'zod'

import { createStubbedAction } from '@/lib/utils/stub-helpers'

import { AttendanceStatus } from './_types'

/**
 * Attendance Actions
 *
 * NOTE: The attendance feature is incomplete. The database models
 * (AttendanceSession, AttendanceRecord) were removed from the schema.
 * These functions are stubbed out until the feature is implemented.
 * TODO: Implement in future PR when attendance feature is prioritized.
 */

const createSessionSchema = z.object({
  batchId: z.string(),
  date: z.string(),
  notes: z.string().optional(),
})

export const createSession = createStubbedAction<
  [z.infer<typeof createSessionSchema>]
>({
  feature: 'createSession',
  reason: 'schema_migration',
  userMessage: 'Attendance feature is not yet implemented.',
})

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

export const markAttendance = createStubbedAction<
  [z.infer<typeof markAttendanceSchema>]
>({
  feature: 'markAttendance',
  reason: 'schema_migration',
  userMessage: 'Attendance feature is not yet implemented.',
})

export const deleteSession = createStubbedAction<[string]>({
  feature: 'deleteSession',
  reason: 'schema_migration',
  userMessage: 'Attendance feature is not yet implemented.',
})
