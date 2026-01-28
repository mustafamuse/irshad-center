import { prisma } from '@/lib/db'
import { DatabaseClient } from '@/lib/db/types'

export async function getTeacherClassIds(
  teacherId: string,
  client: DatabaseClient = prisma
): Promise<string[]> {
  const rows = await client.dugsiClassTeacher.findMany({
    where: { teacherId, isActive: true },
    select: { classId: true },
  })
  return rows.map((r) => r.classId)
}

export async function getStudentsByTeacher(
  teacherId: string,
  client: DatabaseClient = prisma
) {
  const classIds = await getTeacherClassIds(teacherId, client)
  if (classIds.length === 0) return []

  const enrollments = await client.dugsiClassEnrollment.findMany({
    where: { classId: { in: classIds }, isActive: true },
    include: {
      programProfile: {
        include: { person: { select: { name: true, dateOfBirth: true } } },
      },
      class: { select: { name: true, shift: true } },
    },
  })

  const now = new Date()
  const students = enrollments.map((e) => {
    const dob = e.programProfile.person.dateOfBirth
    let age: number | null = null
    if (dob) {
      age = now.getFullYear() - dob.getFullYear()
      const monthDiff = now.getMonth() - dob.getMonth()
      if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
        age--
      }
    }
    return {
      profileId: e.programProfileId,
      name: e.programProfile.person.name,
      age,
      className: e.class.name,
      shift: e.class.shift,
      familyReferenceId: e.programProfile.familyReferenceId,
    }
  })

  students.sort((a, b) => {
    if (a.familyReferenceId && b.familyReferenceId) {
      if (a.familyReferenceId === b.familyReferenceId)
        return a.name.localeCompare(b.name)
      return a.familyReferenceId.localeCompare(b.familyReferenceId)
    }
    if (a.familyReferenceId) return -1
    if (b.familyReferenceId) return 1
    return a.name.localeCompare(b.name)
  })

  return students
}

export async function getStudentProfile(
  profileId: string,
  client: DatabaseClient = prisma
) {
  const enrollment = await client.dugsiClassEnrollment.findUnique({
    where: { programProfileId: profileId },
    include: {
      programProfile: { include: { person: true } },
      class: { select: { id: true, name: true, shift: true } },
    },
  })
  if (!enrollment) return null
  return {
    profileId: enrollment.programProfileId,
    name: enrollment.programProfile.person.name,
    className: enrollment.class.name,
    shift: enrollment.class.shift,
    classId: enrollment.class.id,
  }
}

export async function getStudentAttendanceStats(
  profileId: string,
  client: DatabaseClient = prisma
) {
  const statusCounts = await client.dugsiAttendanceRecord.groupBy({
    by: ['status'],
    where: { programProfileId: profileId },
    _count: { status: true },
  })

  const countByStatus = Object.fromEntries(
    statusCounts.map((s) => [s.status, s._count.status])
  )

  const presentCount = countByStatus['PRESENT'] ?? 0
  const absentCount = countByStatus['ABSENT'] ?? 0
  const lateCount = countByStatus['LATE'] ?? 0
  const excusedCount = countByStatus['EXCUSED'] ?? 0
  const total = presentCount + absentCount + lateCount + excusedCount
  const attendanceRate =
    total > 0 ? Math.round(((presentCount + lateCount) / total) * 1000) / 10 : 0

  const recentRecords = await client.dugsiAttendanceRecord.findMany({
    where: { programProfileId: profileId },
    select: { status: true, session: { select: { date: true } } },
    orderBy: { session: { date: 'desc' } },
  })

  return {
    totalSessions: total,
    attendanceRate,
    recentRecords: recentRecords.map((r) => ({
      status: r.status,
      date: r.session.date,
    })),
    presentCount,
    absentCount,
    lateCount,
    excusedCount,
  }
}

export async function getStudentMonthlyComparison(
  profileId: string,
  client: DatabaseClient = prisma
): Promise<{ diff: number } | null> {
  const now = new Date()
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  const [currentRecords, prevRecords] = await Promise.all([
    client.dugsiAttendanceRecord.groupBy({
      by: ['status'],
      where: {
        programProfileId: profileId,
        session: { date: { gte: currentMonthStart } },
      },
      _count: { status: true },
    }),
    client.dugsiAttendanceRecord.groupBy({
      by: ['status'],
      where: {
        programProfileId: profileId,
        session: { date: { gte: prevMonthStart, lt: currentMonthStart } },
      },
      _count: { status: true },
    }),
  ])

  if (prevRecords.length === 0) return null

  const rate = (records: typeof currentRecords) => {
    const counts = Object.fromEntries(
      records.map((r) => [r.status, r._count.status])
    )
    const present = (counts['PRESENT'] ?? 0) + (counts['LATE'] ?? 0)
    const total =
      (counts['PRESENT'] ?? 0) +
      (counts['ABSENT'] ?? 0) +
      (counts['LATE'] ?? 0) +
      (counts['EXCUSED'] ?? 0)
    return total > 0 ? (present / total) * 100 : 0
  }

  const currentRate = rate(currentRecords)
  const prevRate = rate(prevRecords)
  return { diff: Math.round((currentRate - prevRate) * 10) / 10 }
}

export async function getStudentWeeklyTrend(
  profileId: string,
  weeksBack: number = 12,
  client: DatabaseClient = prisma
) {
  const since = new Date()
  since.setDate(since.getDate() - weeksBack * 7)

  const records = await client.dugsiAttendanceRecord.findMany({
    where: {
      programProfileId: profileId,
      session: { date: { gte: since } },
    },
    select: { status: true, session: { select: { date: true } } },
    orderBy: { session: { date: 'asc' } },
  })

  return records.map((r) => ({ date: r.session.date, status: r.status }))
}

export async function getStudentAttendanceRecords(
  profileId: string,
  pagination: { offset: number; limit: number } = { offset: 0, limit: 20 },
  client: DatabaseClient = prisma
) {
  const { offset, limit } = pagination

  const [records, total] = await Promise.all([
    client.dugsiAttendanceRecord.findMany({
      where: { programProfileId: profileId },
      include: { session: { select: { id: true, date: true } } },
      orderBy: { session: { date: 'desc' } },
      skip: offset,
      take: limit + 1,
    }),
    client.dugsiAttendanceRecord.count({
      where: { programProfileId: profileId },
    }),
  ])

  const hasMore = records.length > limit
  const data = records.slice(0, limit)

  return {
    data: data.map((r) => ({
      sessionId: r.sessionId,
      date: r.session.date.toISOString().split('T')[0],
      status: r.status,
      lessonCompleted: r.lessonCompleted,
      surahName: r.surahName,
      ayatFrom: r.ayatFrom,
      ayatTo: r.ayatTo,
    })),
    hasMore,
    total,
  }
}
