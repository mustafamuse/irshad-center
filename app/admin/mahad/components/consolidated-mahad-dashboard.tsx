'use client'

import { AlertTriangle, Layers, Users } from 'lucide-react'

import {
  DashboardHeader as SharedDashboardHeader,
  DashboardLayout,
  TabPanel,
} from '@/components/admin'
import { BatchWithCount } from '@/lib/db/queries/batch'
import { StudentWithBatchData } from '@/lib/db/queries/student'
import { useMahadTabs, MAHAD_TABS } from '@/lib/hooks/use-admin-tabs'
import { useTabKeyboardShortcuts } from '@/lib/hooks/use-tab-keyboard-shortcuts'

import { useStudentFilters } from '../_hooks/use-student-filters'
import { useStudentStats, useDuplicates } from '../_hooks/use-student-groups'
import { mapBatch, mapStudent } from '../_utils/mappers'
import { useMahadFilters, useDialog } from '../store'
import { DashboardFilters } from './dashboard/dashboard-filters'
import { DashboardStats } from './dashboard/dashboard-stats'
import { MahadDashboardHeaderActions } from './dashboard/mahad-dashboard-header-actions'
import { TabContent } from './dashboard/tab-content'
import {
  AssignStudentsDialog,
  CreateBatchDialog,
  ResolveDuplicatesDialog,
} from './dialogs'

interface ConsolidatedMahadDashboardProps {
  students: StudentWithBatchData[]
  batches: BatchWithCount[]
}

const TAB_CONFIG = [
  { value: 'students', label: 'Students', icon: <Users className="h-4 w-4" /> },
  { value: 'batches', label: 'Batches', icon: <Layers className="h-4 w-4" /> },
  {
    value: 'duplicates',
    label: 'Duplicates',
    icon: <AlertTriangle className="h-4 w-4" />,
  },
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

  const mahadStudents = students.map(mapStudent)
  const mahadBatches = batches.map(mapBatch)

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
