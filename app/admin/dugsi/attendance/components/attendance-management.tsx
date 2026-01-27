import { format } from 'date-fns'

import { Badge } from '@/components/ui/badge'
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
  getEnrolledStudentsByClasses,
  getSessionsForList,
} from '@/lib/db/queries/dugsi-attendance'
import { mapRecordsToMarkingDTOs } from '@/lib/mappers/attendance-mapper'

import { CreateSessionDialog } from './create-session-dialog'
import { DeleteSessionButton } from './delete-session-button'
import { FilterControls } from './filter-controls'
import { MarkAttendanceDialog } from './mark-attendance-dialog'
import { PaginationControls } from './pagination-controls'

interface Props {
  searchParams: {
    page?: string
    fromDate?: string
    toDate?: string
    classId?: string
  }
}

export async function AttendanceManagement({ searchParams }: Props) {
  const filters = {
    classId: searchParams.classId || undefined,
    dateFrom: searchParams.fromDate
      ? new Date(searchParams.fromDate)
      : undefined,
    dateTo: searchParams.toDate ? new Date(searchParams.toDate) : undefined,
  }
  const page = parseInt(searchParams.page || '1')

  const [classes, { data: sessions, total, totalPages }] = await Promise.all([
    getActiveClassesCachedQuery(),
    getSessionsForList(filters, { page, limit: 20 }),
  ])

  const uniqueClassIds = Array.from(new Set(sessions.map((s) => s.classId)))
  const studentsMap = await getEnrolledStudentsByClasses(uniqueClassIds)

  const classOptions = classes.map((c) => ({
    id: c.id,
    name: c.name,
    shift: c.shift,
  }))

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">Sessions</h2>
        <CreateSessionDialog classes={classOptions} />
      </div>

      <FilterControls classes={classOptions} />

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
                  <TableHead>Class</TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Records</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => {
                  const students = studentsMap.get(session.classId) ?? []
                  const presentCount = session.records.filter(
                    (r) => r.status === 'PRESENT' || r.status === 'LATE'
                  ).length

                  return (
                    <TableRow key={session.id}>
                      <TableCell>
                        {format(new Date(session.date), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        {session.class.name} ({session.class.shift})
                      </TableCell>
                      <TableCell>{session.teacher.person.name}</TableCell>
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
                            <MarkAttendanceDialog
                              sessionId={session.id}
                              students={students}
                              attendance={mapRecordsToMarkingDTOs(
                                session.records as never[]
                              )}
                            />
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
