import Link from 'next/link'

import { format } from 'date-fns'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  getActiveClassesCachedQuery,
  getActiveTeachers,
  getSessionsForList,
} from '@/lib/db/queries/dugsi-attendance'

import { CreateSessionDialog } from './create-session-dialog'
import { DeleteSessionButton } from './delete-session-button'
import { FilterControls } from './filter-controls'
import { PaginationControls } from './pagination-controls'

interface Props {
  searchParams: {
    page?: string
    fromDate?: string
    toDate?: string
    classId?: string
    teacherId?: string
  }
}

export async function AttendanceManagement({ searchParams }: Props) {
  const filters = {
    classId: searchParams.classId || undefined,
    teacherId: searchParams.teacherId || undefined,
    dateFrom: searchParams.fromDate
      ? new Date(searchParams.fromDate)
      : undefined,
    dateTo: searchParams.toDate ? new Date(searchParams.toDate) : undefined,
  }
  const page = parseInt(searchParams.page || '1')

  const [classes, teachers, { data: sessions, total, totalPages }] =
    await Promise.all([
      getActiveClassesCachedQuery(),
      getActiveTeachers(),
      getSessionsForList(filters, { page, limit: 20 }),
    ])

  const classOptions = classes.map((c) => {
    const teacherFirst =
      c.teachers?.[0]?.teacher?.person?.name?.split(' ')[0] ?? ''
    const shiftLabel = c.shift === 'MORNING' ? 'AM' : 'PM'
    return {
      id: c.id,
      name: c.name,
      shift: c.shift,
      label: teacherFirst ? `${teacherFirst} - ${shiftLabel}` : shiftLabel,
    }
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">Session History</h2>
        <CreateSessionDialog classes={classOptions} />
      </div>

      <FilterControls
        classes={classOptions}
        teachers={teachers.map((t) => ({ id: t.id, name: t.person.name }))}
      />

      {sessions.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-muted-foreground">
          <p>No attendance sessions found.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Session</TableHead>
                  <TableHead>Records</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => {
                  const presentCount = session.records.filter(
                    (r) => r.status === 'PRESENT' || r.status === 'LATE'
                  ).length

                  return (
                    <TableRow key={session.id}>
                      <TableCell>
                        {format(new Date(session.date), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        {session.teacher.person.name.split(' ')[0]} -{' '}
                        {session.class.shift === 'MORNING' ? 'AM' : 'PM'}
                      </TableCell>
                      <TableCell>
                        {presentCount}/{session.records.length} present
                      </TableCell>
                      <TableCell>
                        {session.isClosed ? (
                          <Badge variant="secondary">Closed</Badge>
                        ) : (
                          <Badge variant="default">Open</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {!session.isClosed && (
                            <Link
                              href={`/admin/dugsi/attendance/${session.id}`}
                            >
                              <Button size="sm" variant="outline">
                                Mark
                              </Button>
                            </Link>
                          )}
                          <DeleteSessionButton sessionId={session.id} />
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <PaginationControls
              page={page}
              totalPages={totalPages}
              total={total}
            />
          )}
        </>
      )}
    </div>
  )
}
