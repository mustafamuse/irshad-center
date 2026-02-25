'use client'

import { useTransition } from 'react'

import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

import {
  TeacherCheckinStatusForClient,
  TeacherOption,
  TeacherWithDetails,
} from '../actions'
import { AttendanceView } from './attendance-view'
import { CreateTeacherDialog } from './create-teacher-dialog'
import { TeacherList } from './teacher-list'

interface Props {
  teachers: TeacherWithDetails[]
  initialCheckinStatuses?: TeacherCheckinStatusForClient[]
  initialTeacherOptions?: TeacherOption[]
}

export function TeachersDashboard({
  teachers,
  initialCheckinStatuses,
  initialTeacherOptions,
}: Props) {
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
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
        </TabsList>

        <TabsContent
          value="teachers"
          className={cn(isPending && 'pointer-events-none opacity-50')}
        >
          <TeacherList teachers={teachers} onTeacherUpdated={handleRefresh} />
        </TabsContent>

        <TabsContent value="attendance">
          <AttendanceView
            onDataChanged={handleRefresh}
            initialCheckinStatuses={initialCheckinStatuses}
            initialTeacherOptions={initialTeacherOptions}
          />
        </TabsContent>
      </Tabs>
    </>
  )
}
