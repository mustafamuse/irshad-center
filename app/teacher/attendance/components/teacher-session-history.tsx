import Link from 'next/link'

import { format } from 'date-fns'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DEFAULT_PAGE_SIZE, SHIFT_SHORT_LABEL } from '@/lib/constants/dugsi'
import { getSessionsForList } from '@/lib/db/queries/dugsi-attendance'
import { isSessionEffectivelyClosed } from '@/lib/utils/attendance-dates'
import { countPresentStudents } from '@/lib/utils/attendance-math'

import { TeacherFilterControls } from './teacher-filter-controls'

interface Props {
  teacherId: string
  searchParams: {
    page?: string
    fromDate?: string
    toDate?: string
    classId?: string
  }
}

export async function TeacherSessionHistory({
  teacherId,
  searchParams,
}: Props) {
  const filters = {
    teacherId,
    classId: searchParams.classId || undefined,
    dateFrom: searchParams.fromDate
      ? new Date(searchParams.fromDate)
      : undefined,
    dateTo: searchParams.toDate ? new Date(searchParams.toDate) : undefined,
  }
  const page = parseInt(searchParams.page || '1')
  const { fromDate, toDate, classId } = searchParams

  const buildPageUrl = (newPage: number): string => {
    const params = new URLSearchParams()
    params.set('page', String(newPage))
    if (fromDate) params.set('fromDate', fromDate)
    if (toDate) params.set('toDate', toDate)
    if (classId) params.set('classId', classId)
    return `/teacher/attendance?${params.toString()}`
  }

  const { data: sessions, totalPages } = await getSessionsForList(filters, {
    page,
    limit: DEFAULT_PAGE_SIZE,
  })

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Session History</h2>

      <TeacherFilterControls />

      {sessions.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-muted-foreground">
          <p>No attendance sessions found.</p>
        </div>
      ) : (
        <>
          <div className="divide-y rounded-lg border">
            {sessions.map((session) => {
              const effectivelyClosed = isSessionEffectivelyClosed(
                new Date(session.date),
                session.isClosed
              )
              const presentCount = countPresentStudents(session.records)
              const total = session.records.length
              const pct =
                total > 0 ? Math.round((presentCount / total) * 100) : 0
              let attendanceColor = 'text-red-600'
              if (pct >= 75) attendanceColor = 'text-green-600'
              else if (pct >= 50) attendanceColor = 'text-yellow-600'
              const shift = SHIFT_SHORT_LABEL[session.class.shift]

              const content = (
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">
                        {format(new Date(session.date), 'EEE, MMM d')}
                      </p>
                      <Badge
                        variant="outline"
                        className="px-1.5 py-0 text-[10px]"
                      >
                        {shift}
                      </Badge>
                    </div>
                    <p className={`text-xs ${attendanceColor}`}>
                      {presentCount}/{total} present ({pct}%)
                    </p>
                  </div>

                  {!effectivelyClosed && (
                    <Link href={`/teacher/attendance/${session.id}`}>
                      <Button size="sm" className="min-h-[44px] min-w-[44px]">
                        {total === 0 ? 'Take Attendance' : 'Edit'}
                      </Button>
                    </Link>
                  )}
                </div>
              )

              if (effectivelyClosed) {
                return (
                  <Link
                    key={session.id}
                    href={`/teacher/attendance/${session.id}`}
                    className="block transition-colors hover:bg-muted/50"
                  >
                    {content}
                  </Link>
                )
              }

              return (
                <div
                  key={session.id}
                  className="transition-colors hover:bg-muted/50"
                >
                  {content}
                </div>
              )
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2">
              {page > 1 && (
                <Link href={buildPageUrl(page - 1)}>
                  <Button variant="outline" size="sm">
                    Previous
                  </Button>
                </Link>
              )}
              <span className="flex items-center text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              {page < totalPages && (
                <Link href={buildPageUrl(page + 1)}>
                  <Button variant="outline" size="sm">
                    Next
                  </Button>
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
