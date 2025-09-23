'use server'

import { revalidatePath } from 'next/cache'

import { AttendanceStatus } from '@prisma/client'
import { z } from 'zod'

import { prisma } from '@/lib/db'

const createSessionSchema = z.object({
  batchId: z.string(),
  date: z.string(),
  notes: z.string().optional(),
})

export async function createSession(
  input: z.infer<typeof createSessionSchema>
) {
  const { batchId, date, notes } = createSessionSchema.parse(input)

  const session = await prisma.attendanceSession.create({
    data: {
      batchId,
      date: new Date(date),
      notes,
    },
  })

  revalidatePath('/admin/attendance')
  return session
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
  input: z.infer<typeof markAttendanceSchema>
) {
  const { sessionId, records } = markAttendanceSchema.parse(input)

  // Get existing records to determine which to create/update
  const existingRecords = await prisma.attendanceRecord.findMany({
    where: { sessionId },
    select: { studentId: true },
  })
  const existingStudentIds = new Set(existingRecords.map((r) => r.studentId))

  // Prepare create and update operations
  const createRecords = records
    .filter((r) => !existingStudentIds.has(r.studentId))
    .map((r) => ({
      sessionId,
      studentId: r.studentId,
      status: r.status,
      notes: r.notes,
    }))

  const updateRecords = records
    .filter((r) => existingStudentIds.has(r.studentId))
    .map((r) =>
      prisma.attendanceRecord.update({
        where: {
          sessionId_studentId: {
            sessionId,
            studentId: r.studentId,
          },
        },
        data: {
          status: r.status,
          notes: r.notes,
        },
      })
    )

  // Execute all operations in a transaction
  await prisma.$transaction([
    ...updateRecords,
    ...(createRecords.length > 0
      ? [prisma.attendanceRecord.createMany({ data: createRecords })]
      : []),
  ])

  revalidatePath('/admin/attendance')
}

export async function deleteSession(sessionId: string) {
  await prisma.attendanceSession.delete({
    where: { id: sessionId },
  })

  revalidatePath('/admin/attendance')
}
