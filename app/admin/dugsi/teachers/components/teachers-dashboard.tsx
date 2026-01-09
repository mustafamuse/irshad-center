'use client'

import { useTransition } from 'react'

import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

import { TeacherWithDetails } from '../actions'
import { CheckinOverview } from './checkin-overview'
import { CreateTeacherDialog } from './create-teacher-dialog'
import { LateReport } from './late-report'
import { TeacherList } from './teacher-list'

interface Props {
  teachers: TeacherWithDetails[]
}

export function TeachersDashboard({ teachers }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleRefresh() {
    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Teachers</h1>
          <p className="mt-2 text-muted-foreground">
            Manage teachers, check-ins, and attendance reports
          </p>
        </div>
        <CreateTeacherDialog onSuccess={handleRefresh}>
          <Button>Create Teacher</Button>
        </CreateTeacherDialog>
      </div>

      <Tabs defaultValue="teachers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="teachers">Teachers</TabsTrigger>
          <TabsTrigger value="checkins">Check-ins</TabsTrigger>
          <TabsTrigger value="late-report">Late Report</TabsTrigger>
        </TabsList>

        <TabsContent
          value="teachers"
          className={cn(isPending && 'pointer-events-none opacity-50')}
        >
          <TeacherList teachers={teachers} onTeacherUpdated={handleRefresh} />
        </TabsContent>

        <TabsContent value="checkins">
          <CheckinOverview onDataChanged={handleRefresh} />
        </TabsContent>

        <TabsContent value="late-report">
          <LateReport />
        </TabsContent>
      </Tabs>
    </>
  )
}
