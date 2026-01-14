'use client'

import { Suspense } from 'react'

import { Users, GraduationCap, BookOpen, ClipboardCheck } from 'lucide-react'

import { Breadcrumbs, FilterChips, MainTabNavigation } from '@/components/admin'
import { useDugsiTabs, DUGSI_TABS } from '@/lib/hooks/use-admin-tabs'
import { useTabKeyboardShortcuts } from '@/lib/hooks/use-tab-keyboard-shortcuts'

import { ClassWithDetails, DugsiRegistration } from '../_types'
import { ClassManagement } from '../classes/_components/class-management'
import { TeacherWithDetails } from '../teachers/actions'
import { DashboardFilters } from './dashboard/dashboard-filters'
import { DashboardHeader } from './dashboard/dashboard-header'
import { DugsiStats } from './dashboard/dashboard-stats'
import { FamiliesTabContent } from './tabs/families-tab-content'
import { TeachersDashboard } from '../teachers/components/teachers-dashboard'

interface ClassTeacherForAssignment {
  id: string
  name: string
}

interface ConsolidatedDugsiDashboardProps {
  registrations: DugsiRegistration[]
  teachers: TeacherWithDetails[]
  classes: ClassWithDetails[]
  classTeachers: ClassTeacherForAssignment[]
}

const TAB_CONFIG = [
  { value: 'families', label: 'Families', icon: <Users className="h-4 w-4" /> },
  {
    value: 'teachers',
    label: 'Teachers',
    icon: <GraduationCap className="h-4 w-4" />,
  },
  {
    value: 'classes',
    label: 'Classes',
    icon: <BookOpen className="h-4 w-4" />,
  },
  {
    value: 'attendance',
    label: 'Attendance',
    icon: <ClipboardCheck className="h-4 w-4" />,
  },
]

const STATUS_CHIPS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active', variant: 'success' as const },
  { value: 'churned', label: 'Churned' },
  {
    value: 'needs-attention',
    label: 'Needs Action',
    variant: 'warning' as const,
  },
  { value: 'billing-mismatch', label: 'Billing', variant: 'warning' as const },
]

function TabLoadingFallback() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-10 w-full rounded bg-muted" />
      <div className="h-96 rounded-lg bg-muted" />
    </div>
  )
}

export function ConsolidatedDugsiDashboard({
  registrations,
  teachers,
  classes,
  classTeachers,
}: ConsolidatedDugsiDashboardProps) {
  const { tab, setTab, status, setStatus } = useDugsiTabs()

  const handleTabChange = (newTab: string) => {
    setTab(newTab as typeof tab)
  }

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus as typeof status)
  }

  useTabKeyboardShortcuts({
    tabs: DUGSI_TABS,
    currentTab: tab,
    onTabChange: handleTabChange,
  })

  const breadcrumbItems = [
    { label: 'Dugsi' },
    { label: TAB_CONFIG.find((t) => t.value === tab)?.label ?? 'Families' },
  ]

  return (
    <div className="space-y-6">
      <Breadcrumbs items={breadcrumbItems} />

      <MainTabNavigation
        tabs={TAB_CONFIG}
        activeTab={tab}
        onTabChange={handleTabChange}
      />

      <div className="min-h-[500px]">
        {tab === 'families' && (
          <>
            <DashboardHeader />
            <div className="mb-6 mt-6 space-y-4">
              <DashboardFilters />
              <DugsiStats
                registrations={registrations}
                onStatClick={() => {}}
              />
              <FilterChips
                chips={STATUS_CHIPS}
                activeChip={status}
                onChipChange={handleStatusChange}
              />
            </div>
            <FamiliesTabContent
              registrations={registrations}
              statusFilter={status}
            />
          </>
        )}

        {tab === 'teachers' && (
          <Suspense fallback={<TabLoadingFallback />}>
            <TeachersDashboard teachers={teachers} />
          </Suspense>
        )}

        {tab === 'classes' && (
          <Suspense fallback={<TabLoadingFallback />}>
            <ClassManagement classes={classes} teachers={classTeachers} />
          </Suspense>
        )}

        {tab === 'attendance' && (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-24 text-center">
            <ClipboardCheck className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="text-lg font-medium">Coming Soon</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Student attendance tracking is under development
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
