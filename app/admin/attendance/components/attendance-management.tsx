import { format } from 'date-fns'

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { prisma } from '@/lib/db'

import { CreateSessionDialog } from './create-session-dialog'
import { FilterControls } from './filter-controls'
import { MarkAttendanceDialog } from './mark-attendance-dialog'

interface Props {
  searchParams: {
    page?: string
    fromDate?: string
    toDate?: string
    batchId?: string
    search?: string
  }
}

export async function AttendanceManagement({ searchParams }: Props) {
  const page = Number(searchParams.page) || 1
  const pageSize = 10

  // Get all batches for the attendance system (weekend program)
  const batches = await prisma.batch.findMany({
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: 'asc',
    },
  })

  // Build where clause for filtering (no weekend restriction - this is a weekend program)
  const where: Record<string, unknown> = {}

  // Add batch filter if specified
  if (searchParams.batchId) {
    where.batchId = searchParams.batchId
  }

  // Add date filters if specified
  if (searchParams.fromDate || searchParams.toDate) {
    where.date = {} as Record<string, Date>
    if (searchParams.fromDate) {
      ;(where.date as Record<string, Date>).gte = new Date(
        searchParams.fromDate
      )
    }
    if (searchParams.toDate) {
      ;(where.date as Record<string, Date>).lte = new Date(searchParams.toDate)
    }
  }

  const [sessionsData, total] = await Promise.all([
    prisma.attendanceSession.findMany({
      where,
      take: pageSize,
      skip: (page - 1) * pageSize,
      orderBy: { date: 'desc' },
      include: {
        batch: {
          select: {
            name: true,
            students: {
              select: { id: true, name: true },
            },
          },
        },
        records: {
          include: {
            student: {
              select: { id: true, name: true },
            },
          },
        },
      },
    }),
    prisma.attendanceSession.count({ where }),
  ])

  const sessions = sessionsData.map((session) => ({
    ...session,
    studentsCount: session.batch.students.length,
    attendanceMarked: session.records.length,
    isComplete: session.records.length === session.batch.students.length,
  }))

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Weekend Sessions</h2>
          <p className="text-sm text-muted-foreground">
            Manage attendance for weekend study sessions
          </p>
        </div>
        <CreateSessionDialog batches={batches} />
      </div>

      <FilterControls batches={batches} />

      {sessions.length === 0 ? (
        <div className="py-10 text-center text-muted-foreground">
          <p>No weekend sessions found.</p>
          <p className="text-sm">
            {Object.keys(searchParams).length > 0
              ? 'Try adjusting your filters'
              : 'Create a new session to get started'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden rounded-md border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Attendance</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>{format(session.date, 'MMM d, yyyy')}</TableCell>
                    <TableCell>{session.batch.name}</TableCell>
                    <TableCell>
                      {session.attendanceMarked}/{session.studentsCount}
                    </TableCell>
                    <TableCell className="text-right">
                      <MarkAttendanceDialog
                        attendance={session.records}
                        sessionId={session.id}
                        students={session.batch.students}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="space-y-4 md:hidden">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="space-y-3 rounded-lg border bg-card p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="text-lg font-medium">
                    {format(session.date, 'MMM d, yyyy')}
                  </div>
                  <div
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      session.isComplete
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {session.isComplete ? 'Complete' : 'Incomplete'}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Batch:</span>
                    <span className="font-medium">{session.batch.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Attendance:</span>
                    <span className="font-medium">
                      {session.attendanceMarked}/{session.studentsCount}{' '}
                      students
                    </span>
                  </div>
                </div>
                <div className="pt-2">
                  <MarkAttendanceDialog
                    attendance={session.records}
                    sessionId={session.id}
                    students={session.batch.students}
                  />
                </div>
              </div>
            ))}
          </div>

          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href={`/admin/attendance?${new URLSearchParams({
                    ...searchParams,
                    page: String(page > 1 ? page - 1 : 1),
                  }).toString()}`}
                />
              </PaginationItem>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <PaginationItem key={p}>
                  <PaginationLink
                    href={`/admin/attendance?${new URLSearchParams({
                      ...searchParams,
                      page: String(p),
                    }).toString()}`}
                    isActive={p === page}
                  >
                    {p}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  href={`/admin/attendance?${new URLSearchParams({
                    ...searchParams,
                    page: String(page < totalPages ? page + 1 : totalPages),
                  }).toString()}`}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </>
      )}
    </div>
  )
}
