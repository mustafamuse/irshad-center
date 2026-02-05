'use client'

import { ReactNode } from 'react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface AttendanceTabsProps {
  sessionsContent: ReactNode
  studentsContent: ReactNode
}

export function AttendanceTabs({
  sessionsContent,
  studentsContent,
}: AttendanceTabsProps) {
  return (
    <Tabs defaultValue="sessions">
      <TabsList>
        <TabsTrigger value="sessions">Sessions</TabsTrigger>
        <TabsTrigger value="students">Students</TabsTrigger>
      </TabsList>
      <TabsContent value="sessions">{sessionsContent}</TabsContent>
      <TabsContent value="students">{studentsContent}</TabsContent>
    </Tabs>
  )
}
