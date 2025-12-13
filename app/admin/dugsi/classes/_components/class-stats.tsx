'use client'

import { BookOpen, Users, Sun, Moon } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface ClassStatsProps {
  totalClasses: number
  activeClasses: number
  totalStudents: number
  morningClasses: number
  afternoonClasses: number
}

export function ClassStats({
  totalClasses,
  activeClasses,
  totalStudents,
  morningClasses,
  afternoonClasses,
}: ClassStatsProps) {
  const stats = [
    {
      title: 'Total Classes',
      value: totalClasses,
      subtitle: `${activeClasses} active`,
      icon: BookOpen,
    },
    {
      title: 'Total Students',
      value: totalStudents,
      subtitle: 'enrolled in classes',
      icon: Users,
    },
    {
      title: 'Morning',
      value: morningClasses,
      subtitle: 'classes',
      icon: Sun,
    },
    {
      title: 'Afternoon',
      value: afternoonClasses,
      subtitle: 'classes',
      icon: Moon,
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            <stat.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground">{stat.subtitle}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
