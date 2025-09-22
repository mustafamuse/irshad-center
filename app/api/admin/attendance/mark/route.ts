import { NextRequest, NextResponse } from 'next/server'
import { markAttendance, bulkMarkAttendance } from '@/lib/queries/attendance'
import { AttendanceStatus } from '@/lib/types/attendance'
import { z } from 'zod'

const MarkAttendanceSchema = z.object({
  studentId: z.string().uuid(),
  sessionId: z.string().uuid(),
  status: z.nativeEnum(AttendanceStatus),
  notes: z.string().optional(),
})

const BulkMarkAttendanceSchema = z.object({
  sessionId: z.string().uuid(),
  attendanceRecords: z.array(
    z.object({
      studentId: z.string().uuid(),
      status: z.nativeEnum(AttendanceStatus),
      notes: z.string().optional(),
    })
  ),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Check if it's a bulk request
    if (body.attendanceRecords) {
      const validatedData = BulkMarkAttendanceSchema.parse(body)
      const results = await bulkMarkAttendance(
        validatedData.sessionId,
        validatedData.attendanceRecords
      )
      return NextResponse.json(results)
    }

    // Single attendance marking
    const validatedData = MarkAttendanceSchema.parse(body)
    const result = await markAttendance(
      validatedData.studentId,
      validatedData.sessionId,
      validatedData.status,
      validatedData.notes
    )

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error marking attendance:', error)
    return NextResponse.json(
      { error: 'Failed to mark attendance' },
      { status: 500 }
    )
  }
}