import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params

    const records = await prisma.attendanceRecord.findMany({
      where: {
        sessionId,
      },
      select: {
        status: true,
      },
    })

    const summary = {
      total: records.length,
      present: records.filter((r) => r.status === 'PRESENT').length,
      absent: records.filter((r) => r.status === 'ABSENT').length,
      late: records.filter((r) => r.status === 'LATE').length,
      excused: records.filter((r) => r.status === 'EXCUSED').length,
    }

    return NextResponse.json({ success: true, data: summary })
  } catch (error) {
    console.error('Error fetching session summary:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch session summary' },
      { status: 500 }
    )
  }
}
