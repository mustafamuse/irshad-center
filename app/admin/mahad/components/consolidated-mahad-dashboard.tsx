'use client'

import { useMemo } from 'react'

import dynamic from 'next/dynamic'

import { AlertTriangle, Layers, Plus, Users } from 'lucide-react'

import {
  DashboardHeader as SharedDashboardHeader,
  DashboardLayout,
  TabPanel,
} from '@/components/admin'
import { Button } from '@/components/ui/button'
import { BatchWithCount } from '@/lib/db/queries/batch'
import { StudentWithBatchData } from '@/lib/db/queries/student'
import { useMahadTabs, MAHAD_TABS } from '@/lib/hooks/use-admin-tabs'
import { useTabKeyboardShortcuts } from '@/lib/hooks/use-tab-keyboard-shortcuts'

import { useStudentFilters } from '../_hooks/use-student-filters'
import { useStudentStats, useDuplicates } from '../_hooks/use-student-groups'
import { mapBatch, mapStudent } from '../_utils/mappers'
import { useMahadFilters, useDialog, useMahadUIStore } from '../store'
import { DashboardFilters } from './dashboard/dashboard-filters'
import { DashboardStats } from './dashboard/dashboard-stats'
import { MahadDashboardHeaderActions } from './dashboard/mahad-dashboard-header-actions'
import { TabContent } from './dashboard/tab-content'

const CreateBatchDialog = dynamic(
  () =>
    import('./dialogs/batch-form-dialog').then((mod) => mod.CreateBatchDialog),
  { ssr: false }
)
const AssignStudentsDialog = dynamic(
  () =>
    import('./dialogs/assign-students-dialog').then(
      (mod) => mod.AssignStudentsDialog
    ),
  { ssr: false }
)
const ResolveDuplicatesDialog = dynamic(
  () =>
    import('./dialogs/resolve-duplicates-dialog').then(
      (mod) => mod.ResolveDuplicatesDialog
    ),
  { ssr: false }
)

interface ConsolidatedMahadDashboardProps {
  students: StudentWithBatchData[]
  batches: BatchWithCount[]
}

const STUDENTS_ICON = <Users className="h-4 w-4" />
const BATCHES_ICON = <Layers className="h-4 w-4" />
const DUPLICATES_ICON = <AlertTriangle className="h-4 w-4" />

const TAB_CONFIG = [
  { value: 'students', label: 'Students', icon: STUDENTS_ICON },
  { value: 'batches', label: 'Batches', icon: BATCHES_ICON },
  { value: 'duplicates', label: 'Duplicates', icon: DUPLICATES_ICON },
]

export function ConsolidatedMahadDashboard({
  students,
  batches,
}: ConsolidatedMahadDashboardProps) {
  const { tab, setTab } = useMahadTabs()
  const filters = useMahadFilters()
  const dialog = useDialog()

  const handleTabChange = (newTab: string) => {
    if (MAHAD_TABS.includes(newTab as (typeof MAHAD_TABS)[number])) {
      setTab(newTab as (typeof MAHAD_TABS)[number])
    }
  }

  useTabKeyboardShortcuts({
    tabs: MAHAD_TABS,
    currentTab: tab,
    onTabChange: handleTabChange,
  })

  const mahadStudents = useMemo(() => students.map(mapStudent), [students])
  const mahadBatches = useMemo(() => batches.map(mapBatch), [batches])

  const filteredStudents = useStudentFilters(mahadStudents, filters)
  const stats = useStudentStats(mahadStudents)
  const duplicates = useDuplicates(mahadStudents)

  const breadcrumbItems = [
    { label: 'Mahad' },
    { label: TAB_CONFIG.find((t) => t.value === tab)?.label ?? 'Students' },
  ]

  const tabsWithCounts = TAB_CONFIG.map((t) => {
    let count: number | undefined
    if (t.value === 'students') count = filteredStudents.length
    if (t.value === 'batches') count = mahadBatches.length
    if (t.value === 'duplicates' && duplicates.length > 0)
      count = duplicates.length
    return { ...t, count }
  })

  return (
    <>
      <DashboardLayout
        breadcrumbs={breadcrumbItems}
        tabs={tabsWithCounts}
        activeTab={tab}
        onTabChange={handleTabChange}
      >
        <TabPanel
          id="tabpanel-students"
          tabValue="students"
          activeTab={tab}
          className="space-y-6"
        >
          <SharedDashboardHeader
            title="Mahad Cohorts"
            description="Manage students, batches, and enrollment"
            actions={<MahadDashboardHeaderActions />}
          />
          <div className="mb-6 mt-6 space-y-4">
            <DashboardStats stats={stats} />
            <DashboardFilters batches={mahadBatches} />
          </div>
          <TabContent
            tab="students"
            students={filteredStudents}
            batches={mahadBatches}
            duplicates={duplicates}
          />
        </TabPanel>

        <TabPanel id="tabpanel-batches" tabValue="batches" activeTab={tab}>
          <SharedDashboardHeader
            title="Batches"
            description="Manage batches and cohort assignments"
            actions={
              <Button
                onClick={() =>
                  useMahadUIStore.getState().openDialog('createBatch', null)
                }
                className="w-full sm:w-auto"
              >
                <Plus className="mr-2 h-4 w-4" />
                New Batch
              </Button>
            }
          />
          <TabContent
            tab="batches"
            students={mahadStudents}
            batches={mahadBatches}
            duplicates={duplicates}
          />
        </TabPanel>

        <TabPanel
          id="tabpanel-duplicates"
          tabValue="duplicates"
          activeTab={tab}
        >
          <TabContent
            tab="duplicates"
            students={mahadStudents}
            batches={mahadBatches}
            duplicates={duplicates}
          />
        </TabPanel>
      </DashboardLayout>

      <CreateBatchDialog />
      <AssignStudentsDialog students={mahadStudents} batches={mahadBatches} />
      <ResolveDuplicatesDialog
        group={dialog.type === 'resolveDuplicates' ? dialog.data : null}
      />
    </>
  )
}
