'use client'

import { Users, GraduationCap, BookOpen, ClipboardCheck } from 'lucide-react'

import {
  DashboardHeader as SharedDashboardHeader,
  DashboardLayout,
  EmptyState,
  FilterChips,
  TabPanel,
} from '@/components/admin'
import { useDugsiTabs, DUGSI_TABS } from '@/lib/hooks/use-admin-tabs'
import { useTabKeyboardShortcuts } from '@/lib/hooks/use-tab-keyboard-shortcuts'

import { ClassWithDetails, DugsiRegistration } from '../_types'
import { ClassManagement } from '../classes/_components/class-management'
import { TeacherWithDetails } from '../teachers/actions'
import { DashboardFilters } from './dashboard/dashboard-filters'
import { DugsiStats } from './dashboard/dashboard-stats'
import { DugsiDashboardHeaderActions } from './dashboard/dugsi-dashboard-header-actions'
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
    <DashboardLayout
      breadcrumbs={breadcrumbItems}
      tabs={TAB_CONFIG}
      activeTab={tab}
      onTabChange={handleTabChange}
    >
      <TabPanel
        id="tabpanel-families"
        tabValue="families"
        activeTab={tab}
        className="space-y-6"
      >
        <SharedDashboardHeader
          title="Dugsi Program Management"
          description="Manage student registrations and family subscriptions"
          actions={<DugsiDashboardHeaderActions />}
        />
        <div className="mb-6 mt-6 space-y-4">
          <DashboardFilters />
          <DugsiStats registrations={registrations} onStatClick={setStatus} />
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
      </TabPanel>

      <TabPanel id="tabpanel-teachers" tabValue="teachers" activeTab={tab}>
        <TeachersDashboard teachers={teachers} />
      </TabPanel>

      <TabPanel id="tabpanel-classes" tabValue="classes" activeTab={tab}>
        <ClassManagement classes={classes} teachers={classTeachers} />
      </TabPanel>

      <TabPanel id="tabpanel-attendance" tabValue="attendance" activeTab={tab}>
        <EmptyState
          icon={ClipboardCheck}
          title="Coming Soon"
          description="Student attendance tracking is under development"
        />
      </TabPanel>
    </DashboardLayout>
  )
}
