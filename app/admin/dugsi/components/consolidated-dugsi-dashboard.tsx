'use client'

import { useEffect, useState } from 'react'

import { Users, GraduationCap, BookOpen, ClipboardCheck } from 'lucide-react'
import { toast } from 'sonner'

import {
  DashboardHeader as SharedDashboardHeader,
  DashboardLayout,
  EmptyState,
  FilterChips,
  TabPanel,
} from '@/components/admin'
import {
  useDugsiTabs,
  DUGSI_TABS,
  FAMILY_STATUS_FILTERS,
} from '@/lib/hooks/use-admin-tabs'
import { useTabKeyboardShortcuts } from '@/lib/hooks/use-tab-keyboard-shortcuts'

import { ClassWithDetails, DugsiRegistration } from '../_types'
import {
  getAllTeachersForClassAssignmentAction,
  getClassesWithDetailsAction,
  getDugsiRegistrations,
} from '../actions'
import { ClassManagement } from '../classes/_components/class-management'
import { getTeachers, TeacherWithDetails } from '../teachers/actions'
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

const FAMILIES_ICON = <Users className="h-4 w-4" />
const TEACHERS_ICON = <GraduationCap className="h-4 w-4" />
const CLASSES_ICON = <BookOpen className="h-4 w-4" />
const ATTENDANCE_ICON = <ClipboardCheck className="h-4 w-4" />

const TAB_CONFIG = [
  { value: 'families', label: 'Families', icon: FAMILIES_ICON },
  { value: 'teachers', label: 'Teachers', icon: TEACHERS_ICON },
  { value: 'classes', label: 'Classes', icon: CLASSES_ICON },
  { value: 'attendance', label: 'Attendance', icon: ATTENDANCE_ICON },
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
  registrations: initialRegistrations,
  teachers,
  classes,
  classTeachers,
}: ConsolidatedDugsiDashboardProps) {
  const { tab, setTab, status, setStatus } = useDugsiTabs()
  const [registrationData, setRegistrationData] = useState(initialRegistrations)
  const [teacherData, setTeacherData] = useState(teachers)
  const [classData, setClassData] = useState(classes)
  const [classTeacherData, setClassTeacherData] = useState(classTeachers)
  const [hasLoadedRegistrations, setHasLoadedRegistrations] = useState(
    initialRegistrations.length > 0
  )
  const [hasLoadedTeachers, setHasLoadedTeachers] = useState(
    teachers.length > 0
  )
  const [hasLoadedClasses, setHasLoadedClasses] = useState(
    classes.length > 0 || classTeachers.length > 0
  )
  const [isLoadingRegistrations, setIsLoadingRegistrations] = useState(false)
  const [isLoadingTeachers, setIsLoadingTeachers] = useState(false)
  const [isLoadingClasses, setIsLoadingClasses] = useState(false)

  const handleTabChange = (newTab: string) => {
    if (DUGSI_TABS.includes(newTab as typeof tab)) {
      setTab(newTab as typeof tab)
    }
  }

  const handleStatusChange = (newStatus: string) => {
    if (FAMILY_STATUS_FILTERS.includes(newStatus as typeof status)) {
      setStatus(newStatus as typeof status)
    }
  }

  useTabKeyboardShortcuts({
    tabs: DUGSI_TABS,
    currentTab: tab,
    onTabChange: handleTabChange,
  })

  useEffect(() => {
    if (tab !== 'families' || hasLoadedRegistrations || isLoadingRegistrations)
      return

    setIsLoadingRegistrations(true)
    getDugsiRegistrations()
      .then((data) => {
        setRegistrationData(data)
        setHasLoadedRegistrations(true)
      })
      .catch(() => {
        toast.error('Failed to load families')
      })
      .finally(() => {
        setIsLoadingRegistrations(false)
      })
  }, [tab, hasLoadedRegistrations, isLoadingRegistrations])

  useEffect(() => {
    if (tab !== 'teachers' || hasLoadedTeachers || isLoadingTeachers) return

    setIsLoadingTeachers(true)
    getTeachers('DUGSI_PROGRAM')
      .then((result) => {
        if (result.success) {
          setTeacherData(result.data ?? [])
          setHasLoadedTeachers(true)
        } else {
          toast.error(result.error ?? 'Failed to load teachers')
        }
      })
      .catch(() => {
        toast.error('Failed to load teachers')
      })
      .finally(() => {
        setIsLoadingTeachers(false)
      })
  }, [tab, hasLoadedTeachers, isLoadingTeachers])

  useEffect(() => {
    if (tab !== 'classes' || hasLoadedClasses || isLoadingClasses) return

    setIsLoadingClasses(true)
    Promise.all([
      getClassesWithDetailsAction(),
      getAllTeachersForClassAssignmentAction(),
    ])
      .then(([classesResult, teachersResult]) => {
        if (classesResult.success) {
          setClassData(classesResult.data ?? [])
        } else {
          toast.error(classesResult.error ?? 'Failed to load classes')
        }
        if (teachersResult.success) {
          setClassTeacherData(teachersResult.data ?? [])
        } else {
          toast.error(teachersResult.error ?? 'Failed to load class teachers')
        }
        if (classesResult.success || teachersResult.success) {
          setHasLoadedClasses(true)
        }
      })
      .catch(() => {
        toast.error('Failed to load classes')
      })
      .finally(() => {
        setIsLoadingClasses(false)
      })
  }, [tab, hasLoadedClasses, isLoadingClasses])

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
          <DugsiStats
            registrations={registrationData}
            onStatClick={setStatus}
          />
          <FilterChips
            chips={STATUS_CHIPS}
            activeChip={status}
            onChipChange={handleStatusChange}
          />
        </div>
        <FamiliesTabContent
          registrations={registrationData}
          statusFilter={status}
        />
      </TabPanel>

      <TabPanel id="tabpanel-teachers" tabValue="teachers" activeTab={tab}>
        <TeachersDashboard teachers={teacherData} />
      </TabPanel>

      <TabPanel id="tabpanel-classes" tabValue="classes" activeTab={tab}>
        <ClassManagement classes={classData} teachers={classTeacherData} />
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
