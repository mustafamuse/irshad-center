import { NextRequest, NextResponse } from 'next/server'

import { z } from 'zod'

import { prisma } from '@/lib/db'

// Map frontend status to Prisma enum
const statusMap = {
  present: 'PRESENT',
  absent: 'ABSENT',
  late: 'LATE',
  excused: 'EXCUSED',
} as const

const attendanceSchema = z.object({
  date: z.string().datetime(),
  batchId: z.string(),
  attendance: z.array(
    z.object({
      studentId: z.string(),
      status: z.enum(['present', 'absent', 'late', 'excused']),
    })
  ),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = attendanceSchema.parse(body)

    // Create attendance session
    await prisma.$transaction(async (tx) => {
      // First, check if a session already exists for this batch and date
      const existingSession = await tx.attendanceSession.findFirst({
        where: {
          batchId: validatedData.batchId,
          date: {
            gte: new Date(new Date(validatedData.date).setHours(0, 0, 0, 0)),
            lt: new Date(
              new Date(validatedData.date).setHours(23, 59, 59, 999)
            ),
          },
        },
      })

      // If session exists, update records, otherwise create new
      const session =
        existingSession ||
        (await tx.attendanceSession.create({
          data: {
            date: new Date(validatedData.date),
            batchId: validatedData.batchId,
          },
        }))

      // If session existed, delete old records
      if (existingSession) {
        await tx.attendanceRecord.deleteMany({
          where: {
            sessionId: session.id,
          },
        })
      }

      // Create new attendance records
      await tx.attendanceRecord.createMany({
        data: validatedData.attendance.map((record) => ({
          sessionId: session.id,
          studentId: record.studentId,
          status: statusMap[record.status],
        })),
      })

      return session
    })

    // Session and records are created in the transaction above

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error marking attendance:', error)
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to mark attendance',
      },
      { status: 500 }
    )
  }
}
