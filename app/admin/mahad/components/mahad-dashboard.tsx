'use client'

import { Layers, Users, AlertTriangle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BatchWithCount } from '@/lib/db/queries/batch'
import { MahadStudent } from '@/lib/db/queries/student'

import { useStudentFilters } from '../_hooks/use-student-filters'
import { useStudentStats, useDuplicates } from '../_hooks/use-student-groups'
import { DuplicateGroup, MahadBatch, TabValue } from '../_types'
import {
  useActiveTab,
  useDialogData,
  useMahadFilters,
  useMahadUIStore,
} from '../store'
import { DashboardFilters } from './dashboard/dashboard-filters'
import { DashboardHeader } from './dashboard/dashboard-header'
import { DashboardStats } from './dashboard/dashboard-stats'
import { TabContent } from './dashboard/tab-content'
import {
  AssignStudentsDialog,
  CreateBatchDialog,
  ResolveDuplicatesDialog,
} from './dialogs'

interface MahadDashboardProps {
  students: MahadStudent[]
  batches: BatchWithCount[]
}

function mapBatch(b: BatchWithCount): MahadBatch {
  return {
    id: b.id,
    name: b.name,
    startDate: b.startDate,
    endDate: b.endDate,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
    studentCount: b.studentCount,
  }
}

export function MahadDashboard({ students, batches }: MahadDashboardProps) {
  const activeTab = useActiveTab()
  const filters = useMahadFilters()
  const dialogData = useDialogData()
  const setActiveTab = useMahadUIStore((s) => s.setActiveTab)

  const mahadBatches = batches.map(mapBatch)

  const filteredStudents = useStudentFilters(students, filters)
  const stats = useStudentStats(students)
  const duplicates = useDuplicates(students)

  return (
    <div className="space-y-6">
      <DashboardHeader />

      <DashboardStats stats={stats} />

      <DashboardFilters batches={mahadBatches} />

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabValue)}
        aria-label="Cohort management tabs"
      >
        <TabsList className="flex h-auto flex-wrap justify-start sm:grid sm:grid-cols-3">
          <TabsTrigger
            value="students"
            className="flex-1 gap-1 px-2 py-2 text-xs sm:gap-2 sm:px-3 sm:text-sm"
          >
            <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Students</span>
            <Badge
              variant="secondary"
              className="ml-1 px-1 text-[10px] sm:px-1.5 sm:text-xs"
            >
              {filteredStudents.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="batches"
            className="flex-1 gap-1 px-2 py-2 text-xs sm:gap-2 sm:px-3 sm:text-sm"
          >
            <Layers className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Batches</span>
            <Badge
              variant="secondary"
              className="ml-1 px-1 text-[10px] sm:px-1.5 sm:text-xs"
            >
              {mahadBatches.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="duplicates"
            className="flex-1 gap-1 px-2 py-2 text-xs sm:gap-2 sm:px-3 sm:text-sm"
          >
            <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Duplicates</span>
            {duplicates.length > 0 && (
              <Badge
                variant="destructive"
                className="ml-1 px-1 text-[10px] sm:px-1.5 sm:text-xs"
              >
                {duplicates.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="students" className="mt-6">
          <TabContent
            tab="students"
            students={filteredStudents}
            batches={mahadBatches}
            duplicates={duplicates}
          />
        </TabsContent>

        <TabsContent value="batches" className="mt-6">
          <TabContent
            tab="batches"
            students={students}
            batches={mahadBatches}
            duplicates={duplicates}
          />
        </TabsContent>

        <TabsContent value="duplicates" className="mt-6">
          <TabContent
            tab="duplicates"
            students={students}
            batches={mahadBatches}
            duplicates={duplicates}
          />
        </TabsContent>
      </Tabs>

      <CreateBatchDialog />
      <AssignStudentsDialog students={students} batches={mahadBatches} />
      <ResolveDuplicatesDialog group={dialogData as DuplicateGroup | null} />
    </div>
  )
}
