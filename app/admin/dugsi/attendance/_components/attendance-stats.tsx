'use client'

import { Check, X, Clock, HelpCircle } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface AttendanceStatsProps {
  totalStudents: number
  presentCount: number
  absentCount: number
  unmarkedCount: number
}

export function AttendanceStats({
  totalStudents,
  presentCount,
  absentCount,
  unmarkedCount,
}: AttendanceStatsProps) {
  const attendanceRate =
    totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0

  const stats = [
    {
      title: 'Present',
      value: presentCount,
      icon: Check,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Absent',
      value: absentCount,
      icon: X,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
    {
      title: 'Unmarked',
      value: unmarkedCount,
      icon: HelpCircle,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Attendance Rate */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Attendance Rate</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{attendanceRate}%</div>
          <p className="text-xs text-muted-foreground">
            {presentCount} of {totalStudents} students
          </p>
        </CardContent>
      </Card>

      {/* Status Cards */}
      {stats.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            <div className={`rounded-full p-1.5 ${stat.bgColor}`}>
              <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground">students</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
