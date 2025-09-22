import { prisma } from '@/lib/db'
import { AttendanceStatus, DayOfWeek, type AttendanceFilters } from '@/lib/types/attendance'
import { format, isWeekend, parseISO } from 'date-fns'

export async function getWeekendSessions(filters?: AttendanceFilters) {
  const whereClause: any = {
    isActive: true,
  }

  // Filter for weekend sessions only
  if (filters?.weekendsOnly !== false) {
    whereClause.schedule = {
      daysOfWeek: {
        hasSome: [DayOfWeek.SATURDAY, DayOfWeek.SUNDAY],
      },
    }
  }

  if (filters?.startDate && filters?.endDate) {
    whereClause.date = {
      gte: filters.startDate,
      lte: filters.endDate,
    }
  }

  if (filters?.batchId) {
    whereClause.schedule = {
      ...whereClause.schedule,
      batchId: filters.batchId,
    }
  }

  if (filters?.subjectId) {
    whereClause.schedule = {
      ...whereClause.schedule,
      subjectId: filters.subjectId,
    }
  }

  const sessions = await prisma.classSession.findMany({
    where: whereClause,
    include: {
      schedule: {
        include: {
          subject: true,
          batch: {
            include: {
              students: {
                where: { status: 'active' },
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      },
      attendance: {
        include: {
          student: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
    orderBy: [{ date: 'desc' }, { startTime: 'asc' }],
  })

  return sessions.map((session: any) => ({
    ...session,
    studentsCount: session.schedule.batch.students.length,
    attendanceMarked: session.attendance.length,
    isComplete: session.attendance.length === session.schedule.batch.students.length,
  }))
}

export async function getSessionById(sessionId: string) {
  return await prisma.classSession.findUnique({
    where: { id: sessionId },
    include: {
      schedule: {
        include: {
          subject: true,
          batch: {
            include: {
              students: {
                where: { status: 'active' },
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      },
      attendance: {
        include: {
          student: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  })
}

export async function markAttendance(
  studentId: string,
  sessionId: string,
  status: AttendanceStatus,
  notes?: string,
) {
  return await prisma.attendance.upsert({
    where: {
      studentId_sessionId: {
        studentId,
        sessionId,
      },
    },
    update: {
      status,
      notes,
      updatedAt: new Date(),
    },
    create: {
      studentId,
      sessionId,
      status,
      notes,
    },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      session: {
        select: {
          id: true,
          date: true,
          startTime: true,
          endTime: true,
          schedule: {
            select: {
              subject: {
                select: {
                  name: true,
                },
              },
              batch: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  })
}

export async function bulkMarkAttendance(
  sessionId: string,
  attendanceRecords: Array<{
    studentId: string
    status: AttendanceStatus
    notes?: string
  }>,
) {
  const results = await Promise.all(
    attendanceRecords.map((record) =>
      markAttendance(record.studentId, sessionId, record.status, record.notes),
    ),
  )

  return results
}

export async function getAttendanceStats(filters?: AttendanceFilters) {
  const whereClause: any = {
    isActive: true,
  }

  if (filters?.weekendsOnly !== false) {
    whereClause.schedule = {
      daysOfWeek: {
        hasSome: [DayOfWeek.SATURDAY, DayOfWeek.SUNDAY],
      },
    }
  }

  if (filters?.startDate && filters?.endDate) {
    whereClause.date = {
      gte: filters.startDate,
      lte: filters.endDate,
    }
  }

  const totalSessions = await prisma.classSession.count({
    where: whereClause,
  })

  const completedSessions = await prisma.classSession.count({
    where: {
      ...whereClause,
      attendance: {
        some: {},
      },
    },
  })

  const totalAttendanceRecords = await prisma.attendance.count({
    where: {
      session: whereClause,
    },
  })

  const presentRecords = await prisma.attendance.count({
    where: {
      session: whereClause,
      status: AttendanceStatus.PRESENT,
    },
  })

  const weekendSessions = await prisma.classSession.count({
    where: {
      ...whereClause,
      schedule: {
        daysOfWeek: {
          hasSome: [DayOfWeek.SATURDAY, DayOfWeek.SUNDAY],
        },
      },
    },
  })

  const averageAttendanceRate = totalAttendanceRecords > 0 ? (presentRecords / totalAttendanceRecords) * 100 : 0

  return {
    totalSessions,
    completedSessions,
    totalStudents: await prisma.student.count({ where: { status: 'active' } }),
    averageAttendanceRate: Math.round(averageAttendanceRate * 100) / 100,
    weekendSessionsCount: weekendSessions,
  }
}

export async function getAttendanceHistory(studentId: string, filters?: AttendanceFilters) {
  const whereClause: any = {
    studentId,
  }

  if (filters?.startDate && filters?.endDate) {
    whereClause.session = {
      date: {
        gte: filters.startDate,
        lte: filters.endDate,
      },
    }
  }

  if (filters?.weekendsOnly) {
    whereClause.session = {
      ...whereClause.session,
      schedule: {
        daysOfWeek: {
          hasSome: [DayOfWeek.SATURDAY, DayOfWeek.SUNDAY],
        },
      },
    }
  }

  return await prisma.attendance.findMany({
    where: whereClause,
    include: {
      session: {
        include: {
          schedule: {
            include: {
              subject: true,
              batch: true,
            },
          },
        },
      },
    },
    orderBy: {
      session: {
        date: 'desc',
      },
    },
  })
}

export async function createWeekendSession(data: {
  classScheduleId: string
  date: Date
  startTime: Date
  endTime: Date
  notes?: string
}) {
  // Check if session already exists for this date and schedule
  const existingSession = await prisma.classSession.findFirst({
    where: {
      classScheduleId: data.classScheduleId,
      date: {
        gte: new Date(data.date.getFullYear(), data.date.getMonth(), data.date.getDate()),
        lt: new Date(data.date.getFullYear(), data.date.getMonth(), data.date.getDate() + 1),
      },
    },
  })

  if (existingSession) {
    throw new Error('Session already exists for this date and schedule')
  }

  return await prisma.classSession.create({
    data: {
      classScheduleId: data.classScheduleId,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      notes: data.notes,
      status: 'SCHEDULED',
    },
    include: {
      schedule: {
        include: {
          subject: true,
          batch: {
            include: {
              students: {
                where: { status: 'active' },
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      },
    },
  })
}