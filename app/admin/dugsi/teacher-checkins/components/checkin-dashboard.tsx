'use client'

import { useState } from 'react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import type {
  TeacherCheckinWithRelations,
  TeacherWithCheckinStatus,
} from '../_types'
import { CheckinHistory } from './checkin-history'
import { DeleteCheckinDialog } from './delete-checkin-dialog'
import { EditCheckinDialog } from './edit-checkin-dialog'
import { LateReport } from './late-report'
import { TodayCheckins } from './today-checkins'

type TabValue = 'today' | 'history' | 'late-report'

interface CheckinDashboardProps {
  initialTodayData: TeacherWithCheckinStatus[]
}

export function CheckinDashboard({ initialTodayData }: CheckinDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabValue>('today')
  const [editingCheckin, setEditingCheckin] =
    useState<TeacherCheckinWithRelations | null>(null)
  const [deletingCheckin, setDeletingCheckin] =
    useState<TeacherCheckinWithRelations | null>(null)

  const handleEdit = (checkin: TeacherCheckinWithRelations) => {
    setEditingCheckin(checkin)
  }

  const handleDelete = (checkin: TeacherCheckinWithRelations) => {
    setDeletingCheckin(checkin)
  }

  return (
    <>
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabValue)}
      >
        <TabsList>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="late-report">Late Report</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="mt-6">
          <TodayCheckins initialData={initialTodayData} />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <CheckinHistory onEdit={handleEdit} onDelete={handleDelete} />
        </TabsContent>

        <TabsContent value="late-report" className="mt-6">
          <LateReport />
        </TabsContent>
      </Tabs>

      <EditCheckinDialog
        checkin={editingCheckin}
        open={editingCheckin !== null}
        onOpenChange={(open) => !open && setEditingCheckin(null)}
      />

      <DeleteCheckinDialog
        checkin={deletingCheckin}
        open={deletingCheckin !== null}
        onOpenChange={(open) => !open && setDeletingCheckin(null)}
      />
    </>
  )
}
