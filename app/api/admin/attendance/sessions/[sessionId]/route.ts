import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params

    await prisma.$transaction(async (tx) => {
      // Delete all attendance records for this session
      await tx.attendanceRecord.deleteMany({
        where: {
          sessionId,
        },
      })

      // Delete the session itself
      await tx.attendanceSession.delete({
        where: {
          id: sessionId,
        },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting session:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete session' },
      { status: 500 }
    )
  }
}
