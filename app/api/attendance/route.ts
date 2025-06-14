import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')

  if (!sessionId) {
    return NextResponse.json(
      { error: 'Session ID is required' },
      { status: 400 }
    )
  }

  try {
    const attendance = await prisma.attendance.findMany({
      where: {
        classSessionId: sessionId,
      },
      include: {
        student: true,
      },
    })

    return NextResponse.json(attendance)
  } catch (error) {
    console.error('Failed to fetch attendance:', error)
    return NextResponse.json(
      { error: 'Failed to fetch attendance' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { sessionId, attendance } = body

    if (!sessionId || !attendance) {
      return NextResponse.json(
        { error: 'Session ID and attendance records are required' },
        { status: 400 }
      )
    }

    // Create or update attendance records
    const records = await Promise.all(
      attendance.map((record: any) =>
        prisma.attendance.upsert({
          where: {
            studentId_classSessionId: {
              studentId: record.studentId,
              classSessionId: sessionId,
            },
          },
          update: {
            isPresent: record.isPresent,
            note: record.note,
          },
          create: {
            studentId: record.studentId,
            classSessionId: sessionId,
            isPresent: record.isPresent,
            note: record.note,
          },
        })
      )
    )

    return NextResponse.json(records)
  } catch (error) {
    console.error('Failed to save attendance:', error)
    return NextResponse.json(
      { error: 'Failed to save attendance' },
      { status: 500 }
    )
  }
}
