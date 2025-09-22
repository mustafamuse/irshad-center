import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const updateRecordSchema = z.object({
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
  notes: z.string().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: { recordId: string } }
) {
  try {
    const { recordId } = params
    const body = await request.json()

    const validatedData = updateRecordSchema.parse(body)

    const updatedRecord = await prisma.attendanceRecord.update({
      where: {
        id: recordId,
      },
      data: {
        status: validatedData.status,
        notes: validatedData.notes,
      },
    })

    return NextResponse.json({ success: true, data: updatedRecord })
  } catch (error) {
    console.error('Error updating attendance record:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { success: false, error: 'Failed to update attendance record' },
      { status: 500 }
    )
  }
}
