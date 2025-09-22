import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const batchId = searchParams.get('batchId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const sessions = await prisma.attendanceSession.findMany({
      where: {
        batchId: batchId || undefined,
        date: {
          gte: startDate ? new Date(startDate) : undefined,
          lte: endDate ? new Date(endDate) : undefined,
        },
      },
      include: {
        batch: {
          select: {
            name: true,
          },
        },
        records: {
          include: {
            student: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    })

    // Transform the data for easier frontend consumption
    const formattedSessions = sessions.map((session) => ({
      id: session.id,
      date: session.date,
      batchName: session.batch.name,
      summary: {
        total: session.records.length,
        present: session.records.filter((r) => r.status === 'PRESENT').length,
        absent: session.records.filter((r) => r.status === 'ABSENT').length,
        late: session.records.filter((r) => r.status === 'LATE').length,
        excused: session.records.filter((r) => r.status === 'EXCUSED').length,
      },
      records: session.records.map((record) => ({
        id: record.id,
        studentName: record.student.name,
        studentEmail: record.student.email,
        status: record.status,
      })),
    }))

    return NextResponse.json({
      success: true,
      data: formattedSessions,
    })
  } catch (error) {
    console.error('Error fetching attendance history:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch attendance history',
      },
      { status: 500 }
    )
  }
}
