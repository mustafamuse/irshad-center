import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getAttendanceStats } from '@/lib/db/queries/dugsi-attendance'

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  )
}

export async function AttendanceStats() {
  const stats = await getAttendanceStats()

  return (
    <>
      <StatCard label="Total Sessions" value={stats.totalSessions} />
      <StatCard label="Total Records" value={stats.totalRecords} />
      <StatCard label="Attendance Rate" value={`${stats.attendanceRate}%`} />
      <StatCard
        label="Present / Late / Absent"
        value={`${stats.presentCount} / ${stats.lateCount} / ${stats.absentCount}`}
      />
    </>
  )
}
