import { Card } from '@/components/ui/card'
import { prisma } from '@/lib/db'

export async function AttendanceStats() {
  // Get stats directly with Prisma (Server Component pattern)
  const [totalSessions, activeStudents] = await Promise.all([
    // Total attendance sessions (all sessions in weekend program)
    prisma.attendanceSession.count(),

    // Active students (attended at least one session)
    prisma.student.count({
      where: {
        AttendanceRecord: {
          some: {},
        },
      },
    }),
  ])

  // Get completed sessions and average attendance
  const completedSessions = await prisma.$queryRaw<{ count: number }[]>`
    SELECT COUNT(DISTINCT s.id) as count
    FROM "AttendanceSession" s
    WHERE (
      SELECT COUNT(DISTINCT r.id)
      FROM "AttendanceRecord" r
      WHERE r."sessionId" = s.id
    ) = (
      SELECT COUNT(DISTINCT st.id)
      FROM "Student" st
      WHERE st."batchId" = s."batchId"
    )
  `

  const attendanceRate = await prisma.$queryRaw<{ rate: number }[]>`
    WITH SessionCounts AS (
      SELECT 
        s.id,
        COUNT(DISTINCT r.id) as marked_count,
        COUNT(DISTINCT st.id) as total_students
      FROM "AttendanceSession" s
      LEFT JOIN "AttendanceRecord" r ON r."sessionId" = s.id AND r.status = 'PRESENT'
      LEFT JOIN "Student" st ON st."batchId" = s."batchId"
      GROUP BY s.id
    )
    SELECT 
      COALESCE(
        ROUND(
          AVG(
            CASE 
              WHEN total_students > 0 
              THEN (marked_count::float / total_students) * 100 
              ELSE 0 
            END
          )
        ),
        0
      ) as rate
    FROM SessionCounts
  `

  const stats = {
    totalSessions,
    completedSessions: completedSessions[0]?.count || 0,
    activeStudents,
    averageAttendance: attendanceRate[0]?.rate || 0,
  }

  return (
    <>
      <Card className="space-y-2 p-4">
        <p className="text-sm font-medium text-muted-foreground">
          Total Sessions
        </p>
        <p className="text-2xl font-bold">{stats.totalSessions}</p>
      </Card>
      <Card className="space-y-2 p-4">
        <p className="text-sm font-medium text-muted-foreground">Completed</p>
        <p className="text-2xl font-bold">{stats.completedSessions}</p>
      </Card>
      <Card className="space-y-2 p-4">
        <p className="text-sm font-medium text-muted-foreground">
          Active Students
        </p>
        <p className="text-2xl font-bold">{stats.activeStudents}</p>
      </Card>
      <Card className="space-y-2 p-4">
        <p className="text-sm font-medium text-muted-foreground">
          Avg. Attendance
        </p>
        <p className="text-2xl font-bold">{stats.averageAttendance}%</p>
      </Card>
    </>
  )
}
