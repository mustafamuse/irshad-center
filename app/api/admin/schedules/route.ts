import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { DayOfWeek } from '@/lib/types/attendance'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const weekendsOnly = searchParams.get('weekendsOnly') === 'true'

    const whereClause: any = {
      isActive: true,
    }

    if (weekendsOnly) {
      whereClause.daysOfWeek = {
        hasSome: [DayOfWeek.SATURDAY, DayOfWeek.SUNDAY],
      }
    }

    const schedules = await prisma.classSchedule.findMany({
      where: whereClause,
      include: {
        subject: {
          select: {
            id: true,
            name: true,
          },
        },
        batch: {
          select: {
            id: true,
            name: true,
            students: {
              where: { status: 'active' },
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        semester: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { subject: { name: 'asc' } },
        { batch: { name: 'asc' } },
      ],
    })

    return NextResponse.json(schedules)
  } catch (error) {
    console.error('Error fetching schedules:', error)
    return NextResponse.json(
      { error: 'Failed to fetch schedules' },
      { status: 500 }
    )
  }
}