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
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { prisma } from '@/lib/db'
import { isValidDate } from '@/lib/utils'

import { CreateSessionDialog } from './create-session-dialog'
import { FilterControls } from './filter-controls'
import { SessionCard } from './session-card'
import { SessionRow } from './session-row'

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

  // Add date filters if specified (with validation)
  if (searchParams.fromDate || searchParams.toDate) {
    where.date = {} as Record<string, Date>
    if (searchParams.fromDate && isValidDate(searchParams.fromDate)) {
      ;(where.date as Record<string, Date>).gte = new Date(
        searchParams.fromDate
      )
    }
    if (searchParams.toDate && isValidDate(searchParams.toDate)) {
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
          select: {
            id: true,
            status: true,
            notes: true,
            checkInMethod: true,
            checkedInAt: true,
            createdAt: true,
            updatedAt: true,
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
                  <SessionRow key={session.id} session={session} />
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="space-y-4 md:hidden">
            {sessions.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>

          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href={`/admin/attendance?${new URLSearchParams(
                    Object.fromEntries(
                      Object.entries({
                        ...searchParams,
                        page: String(page > 1 ? page - 1 : 1),
                      }).filter(
                        ([, value]) => value !== undefined && value !== ''
                      )
                    )
                  ).toString()}`}
                />
              </PaginationItem>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <PaginationItem key={p}>
                  <PaginationLink
                    href={`/admin/attendance?${new URLSearchParams(
                      Object.fromEntries(
                        Object.entries({
                          ...searchParams,
                          page: String(p),
                        }).filter(
                          ([, value]) => value !== undefined && value !== ''
                        )
                      )
                    ).toString()}`}
                    isActive={p === page}
                  >
                    {p}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  href={`/admin/attendance?${new URLSearchParams(
                    Object.fromEntries(
                      Object.entries({
                        ...searchParams,
                        page: String(page < totalPages ? page + 1 : totalPages),
                      }).filter(
                        ([, value]) => value !== undefined && value !== ''
                      )
                    )
                  ).toString()}`}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </>
      )}
    </div>
  )
}
