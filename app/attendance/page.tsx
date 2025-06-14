import { Suspense } from 'react'

import { format } from 'date-fns'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { CalendarView } from '../components/attendance/calendar-view'
import { ClassCard } from '../components/attendance/class-card'

async function getSchedules() {
  // TODO: Replace with actual API call
  return [
    {
      id: '1',
      subject: 'Mathematics',
      teacher: 'John Doe',
      startTime: '09:00',
      endTime: '10:30',
      dayOfWeek: 1,
    },
    {
      id: '2',
      subject: 'Physics',
      teacher: 'Jane Smith',
      startTime: '11:00',
      endTime: '12:30',
      dayOfWeek: 2,
    },
  ]
}

export default async function AttendancePage() {
  const schedules = await getSchedules()

  return (
    <div className="container mx-auto space-y-6 px-4 py-6 sm:space-y-8 sm:py-10">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center sm:gap-0">
        <h1 className="text-2xl font-bold sm:text-3xl">
          Class Schedule & Attendance
        </h1>
        <div className="text-sm text-muted-foreground">
          {format(new Date(), 'MMMM d, yyyy')}
        </div>
      </div>

      <Tabs defaultValue="schedule" className="space-y-4">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="schedule" className="flex-1 sm:flex-none">
            Schedule
          </TabsTrigger>
          <TabsTrigger value="attendance" className="flex-1 sm:flex-none">
            Attendance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="schedule" className="min-h-[500px] space-y-4">
          <Suspense
            fallback={<Skeleton className="h-[500px] w-full sm:h-[600px]" />}
          >
            <CalendarView schedules={schedules} />
          </Suspense>
        </TabsContent>

        <TabsContent value="attendance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">
                Today's Classes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {schedules.map((schedule) => (
                  <ClassCard
                    key={schedule.id}
                    id={schedule.id}
                    subject={schedule.subject}
                    teacher={schedule.teacher}
                    startTime={schedule.startTime}
                    endTime={schedule.endTime}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
