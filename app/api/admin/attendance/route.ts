import { NextRequest, NextResponse } from 'next/server'
import { getWeekendSessions, getAttendanceStats } from '@/lib/queries/attendance'
import { AttendanceFilters } from '@/lib/types/attendance'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const filters: AttendanceFilters = {
      startDate: searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined,
      endDate: searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined,
      batchId: searchParams.get('batchId') || undefined,
      subjectId: searchParams.get('subjectId') || undefined,
      weekendsOnly: searchParams.get('weekendsOnly') === 'true',
    }

    const action = searchParams.get('action')

    if (action === 'stats') {
      const stats = await getAttendanceStats(filters)
      return NextResponse.json(stats)
    }

    const sessions = await getWeekendSessions(filters)
    return NextResponse.json(sessions)
  } catch (error) {
    console.error('Error fetching attendance data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch attendance data' },
      { status: 500 }
    )
  }
}