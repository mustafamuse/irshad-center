'use server'

import { revalidatePath } from 'next/cache'

import { AttendanceStatus, CheckInMethod } from '@prisma/client'
import QRCode from 'qrcode'
import { z } from 'zod'

import { prisma } from '@/lib/db'
import { validateGeofence } from '@/lib/geolocation'
import { generateQRToken, verifyQRToken } from '@/lib/qr-token'

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

// QR Code Self-Check-In Actions

const toggleSelfCheckInSchema = z.object({
  sessionId: z.string(),
  enabled: z.boolean(),
})

export async function toggleSelfCheckIn(
  input: z.infer<typeof toggleSelfCheckInSchema>
) {
  const { sessionId, enabled } = toggleSelfCheckInSchema.parse(input)

  await prisma.attendanceSession.update({
    where: { id: sessionId },
    data: {
      allowSelfCheckIn: enabled,
      qrTokens: enabled ? {} : undefined, // Clear tokens when disabling
    },
  })

  revalidatePath('/admin/attendance')
}

export async function generateQRCode(sessionId: string): Promise<string> {
  // Verify session exists and allows self check-in
  const session = await prisma.attendanceSession.findUnique({
    where: { id: sessionId },
    select: { allowSelfCheckIn: true },
  })

  if (!session?.allowSelfCheckIn) {
    throw new Error('Self check-in not enabled for this session')
  }

  // Generate JWT token
  const token = generateQRToken(sessionId)

  // Create QR code data URL - this will point to the student check-in page
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const checkInUrl = `${baseUrl}/attendance/checkin/${token}`

  console.log('Generated QR URL:', checkInUrl)

  // Generate QR code as data URL
  const qrCodeDataUrl = await QRCode.toDataURL(checkInUrl, {
    width: 256,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
  })

  return qrCodeDataUrl
}

const selfCheckInSchema = z.object({
  token: z.string(),
  studentId: z.string(),
  coordinates: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }),
})

export async function selfCheckIn(
  input: z.infer<typeof selfCheckInSchema>
): Promise<{ success: boolean; message: string }> {
  try {
    const { token, studentId, coordinates } = selfCheckInSchema.parse(input)

    // Verify and decode token
    const tokenPayload = verifyQRToken(token)
    if (!tokenPayload) {
      return {
        success: false,
        message:
          'Invalid or expired QR code. Please ask your teacher for a new one.',
      }
    }

    // Validate geolocation
    const geofenceResult = validateGeofence(coordinates)
    if (!geofenceResult.isWithinBounds) {
      return {
        success: false,
        message: `You must be within ${geofenceResult.maxDistance}m of the center to check in. You are ${Math.round(geofenceResult.distance)}m away.`,
      }
    }

    // Check if session exists and allows self check-in
    const session = await prisma.attendanceSession.findUnique({
      where: { id: tokenPayload.sessionId },
      select: {
        id: true,
        allowSelfCheckIn: true,
        batch: {
          select: {
            students: {
              where: { id: studentId },
              select: { id: true, name: true },
            },
          },
        },
      },
    })

    if (!session?.allowSelfCheckIn) {
      return {
        success: false,
        message: 'Self check-in is not enabled for this session.',
      }
    }

    // Verify student belongs to this batch
    if (session.batch.students.length === 0) {
      return {
        success: false,
        message: 'You are not enrolled in this class.',
      }
    }

    // Check if already checked in
    const existingRecord = await prisma.attendanceRecord.findUnique({
      where: {
        sessionId_studentId: {
          sessionId: tokenPayload.sessionId,
          studentId,
        },
      },
    })

    if (existingRecord) {
      return {
        success: false,
        message: 'You have already checked in for this session.',
      }
    }

    // Create attendance record
    await prisma.attendanceRecord.create({
      data: {
        sessionId: tokenPayload.sessionId,
        studentId,
        status: AttendanceStatus.PRESENT,
        checkInMethod: CheckInMethod.QR_CODE,
        checkedInAt: new Date(),
      },
    })

    revalidatePath('/admin/attendance')

    return {
      success: true,
      message: 'Successfully checked in!',
    }
  } catch (error) {
    console.error('Self check-in error:', error)
    return {
      success: false,
      message: 'An error occurred during check-in. Please try again.',
    }
  }
}
