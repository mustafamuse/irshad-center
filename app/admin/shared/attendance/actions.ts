'use server'

import { z } from 'zod'

import { AttendanceStatus } from './_types'

/**
 * Attendance Actions
 *
 * NOTE: The attendance feature is incomplete. The database models
 * (AttendanceSession, AttendanceRecord) were removed from the schema.
 * These functions are stubbed out until the feature is implemented.
 */

const createSessionSchema = z.object({
  batchId: z.string(),
  date: z.string(),
  notes: z.string().optional(),
})

export async function createSession(
  _input: z.infer<typeof createSessionSchema>
) {
  throw new Error('Attendance feature is not yet implemented')
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
) {
  throw new Error('Attendance feature is not yet implemented')
}

export async function deleteSession(_sessionId: string) {
  throw new Error('Attendance feature is not yet implemented')
}
