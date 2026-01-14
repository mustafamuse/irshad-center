'use client'

import { AlertTriangle, Layers, Users } from 'lucide-react'

import { Breadcrumbs, MainTabNavigation } from '@/components/admin'
import { BatchWithCount } from '@/lib/db/queries/batch'
import { StudentWithBatchData } from '@/lib/db/queries/student'
import { useMahadTabs, MAHAD_TABS } from '@/lib/hooks/use-admin-tabs'
import { useTabKeyboardShortcuts } from '@/lib/hooks/use-tab-keyboard-shortcuts'

import { useStudentFilters } from '../_hooks/use-student-filters'
import { useStudentStats, useDuplicates } from '../_hooks/use-student-groups'
import { DuplicateGroup, MahadBatch, MahadStudent } from '../_types'
import { useMahadFilters, useDialogData } from '../store'
import { DashboardFilters } from './dashboard/dashboard-filters'
import { DashboardHeader } from './dashboard/dashboard-header'
import { DashboardStats } from './dashboard/dashboard-stats'
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

function mapStudent(s: StudentWithBatchData): MahadStudent {
  return {
    id: s.id,
    name: s.name,
    email: s.email ?? null,
    phone: s.phone ?? null,
    dateOfBirth: s.dateOfBirth ?? null,
    gradeLevel: s.gradeLevel ?? null,
    schoolName: s.schoolName ?? null,
    graduationStatus: s.graduationStatus ?? null,
    paymentFrequency: s.paymentFrequency ?? null,
    billingType: s.billingType ?? null,
    paymentNotes: s.paymentNotes ?? null,
    status: s.status,
    batchId: s.batchId ?? null,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    batch: s.batch
      ? {
          id: s.batch.id,
          name: s.batch.name,
          startDate: s.batch.startDate,
          endDate: s.batch.endDate,
        }
      : null,
    subscription: s.subscription
      ? {
          id: s.subscription.id,
          status: s.subscription.status,
          stripeSubscriptionId: s.subscription.stripeSubscriptionId,
          amount: s.subscription.amount,
        }
      : null,
    siblingCount: s.siblingCount,
  }
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

export function ConsolidatedMahadDashboard({
  students,
  batches,
}: ConsolidatedMahadDashboardProps) {
  const { tab, setTab } = useMahadTabs()
  const filters = useMahadFilters()
  const dialogData = useDialogData()

  const handleTabChange = (newTab: string) => {
    setTab(newTab as typeof tab)
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
    <div className="space-y-6">
      <Breadcrumbs items={breadcrumbItems} />

      <MainTabNavigation
        tabs={tabsWithCounts}
        activeTab={tab}
        onTabChange={handleTabChange}
      />

      <div className="min-h-[500px]">
        {tab === 'students' && (
          <>
            <DashboardHeader />
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
          </>
        )}

        {tab === 'batches' && (
          <TabContent
            tab="batches"
            students={mahadStudents}
            batches={mahadBatches}
            duplicates={duplicates}
          />
        )}

        {tab === 'duplicates' && (
          <TabContent
            tab="duplicates"
            students={mahadStudents}
            batches={mahadBatches}
            duplicates={duplicates}
          />
        )}
      </div>

      <CreateBatchDialog />
      <AssignStudentsDialog students={mahadStudents} batches={mahadBatches} />
      <ResolveDuplicatesDialog group={dialogData as DuplicateGroup | null} />
    </div>
  )
}
