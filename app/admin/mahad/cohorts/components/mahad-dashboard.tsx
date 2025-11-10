'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  LayoutDashboard,
  Users,
  GraduationCap,
} from 'lucide-react'

import type { Student } from '@prisma/client'
import type { StudentWithBatch } from '@/lib/db/queries/student'
import type { BatchWithCount } from '@/lib/types/batch'
import { exportMahadStudentsToCSV } from '@/lib/mahad-csv-export'

import { OverviewTab } from './tabs/overview-tab'
import { NeedsAttentionTab } from './tabs/needs-attention-tab'
import { ActiveTab } from './tabs/active-tab'
import { AllStudentsTab } from './tabs/all-students-tab'
import { BatchesTab } from './tabs/batches-tab'
import { useKeyboardShortcuts } from '../hooks/use-keyboard-shortcuts'

interface MahadDashboardProps {
  students: StudentWithBatch[]
  studentsWithPayment: Student[]
  batches: BatchWithCount[]
  duplicates: Array<{ name: string; students: Student[] }>
}

export function MahadDashboard({
  students,
  studentsWithPayment,
  batches,
  duplicates,
}: MahadDashboardProps) {
  const [activeTab, setActiveTab] = useState('overview')

  // Ensure arrays are defined
  const safeStudents = students || []
  const safeStudentsWithPayment = studentsWithPayment || []
  const safeBatches = batches || []
  const safeDuplicates = duplicates || []

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onTabChange: setActiveTab,
    onExportCSV: () => {
      const timestamp = new Date().toISOString().split('T')[0]
      const filename = `mahad-students-${activeTab}-${timestamp}`
      // Export students based on current tab
      const studentsToExport = (() => {
        switch (activeTab) {
          case 'needs-attention':
            return safeStudents.filter((s) => {
              const needsAttention = safeStudentsWithPayment.find((sp) => sp.id === s.id)
              return needsAttention?.subscriptionStatus !== 'active' && needsAttention?.subscriptionStatus !== null
            })
          case 'active':
            return safeStudents.filter((s) => {
              const active = safeStudentsWithPayment.find((sp) => sp.id === s.id)
              return active?.subscriptionStatus === 'active'
            })
          case 'all':
          default:
            return safeStudents
        }
      })()
      exportMahadStudentsToCSV(studentsToExport, filename)
    },
  })

  // Calculate stats
  const stats = {
    total: safeStudentsWithPayment.length,
    active: safeStudentsWithPayment.filter((s) => s.subscriptionStatus === 'active')
      .length,
    needsAttention: safeStudentsWithPayment.filter(
      (s) => s.subscriptionStatus !== 'active' && s.subscriptionStatus !== null
    ).length,
    incomplete: safeStudentsWithPayment.filter(
      (s) => s.subscriptionStatus === 'incomplete'
    ).length,
    pastDue: safeStudentsWithPayment.filter(
      (s) => s.subscriptionStatus === 'past_due'
    ).length,
    noSubscription: safeStudentsWithPayment.filter(
      (s) => !s.stripeSubscriptionId
    ).length,
  }

  // Calculate health percentage
  const healthPercentage =
    stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Always-Visible Health Dashboard */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Payment Health Overview</h2>
              <p className="text-muted-foreground">
                {stats.total} total students across {batches.length} cohorts
              </p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold text-green-600">
                {healthPercentage}%
              </div>
              <p className="text-sm text-muted-foreground">Active</p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.active}</p>
                  <p className="text-sm text-muted-foreground">Active</p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-red-100 p-2 dark:bg-red-900">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.pastDue}</p>
                  <p className="text-sm text-muted-foreground">Past Due</p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-yellow-100 p-2 dark:bg-yellow-900">
                  <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.incomplete}</p>
                  <p className="text-sm text-muted-foreground">Incomplete</p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-gray-100 p-2 dark:bg-gray-800">
                  <XCircle className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.noSubscription}</p>
                  <p className="text-sm text-muted-foreground">
                    No Subscription
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Duplicate Detection Alert */}
          {duplicates.length > 0 && (
            <Card className="border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                <p className="font-medium text-amber-900 dark:text-amber-100">
                  {duplicates.length} potential duplicate{' '}
                  {duplicates.length === 1 ? 'student' : 'students'} detected
                </p>
                <button
                  onClick={() => setActiveTab('overview')}
                  className="ml-auto text-sm text-amber-600 underline hover:text-amber-700"
                >
                  View Details
                </button>
              </div>
            </Card>
          )}
        </div>
      </Card>

      {/* Tabbed Interface */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex items-center justify-between">
          <TabsList className="grid grid-cols-5">
            <TabsTrigger value="overview" className="gap-2" title="Press 1 to navigate">
              <span className="text-xs text-muted-foreground">1</span>
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="needs-attention" className="gap-2" title="Press 2 to navigate">
              <span className="text-xs text-muted-foreground">2</span>
              <AlertCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Needs Attention</span>
              {stats.needsAttention > 0 && (
                <Badge variant="destructive" className="ml-1">
                  {stats.needsAttention}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="active" className="gap-2" title="Press 3 to navigate">
              <span className="text-xs text-muted-foreground">3</span>
              <CheckCircle2 className="h-4 w-4" />
              <span className="hidden sm:inline">Active</span>
              <Badge variant="secondary" className="ml-1">
                {stats.active}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="all" className="gap-2" title="Press 4 to navigate">
              <span className="text-xs text-muted-foreground">4</span>
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">All Students</span>
              <Badge variant="outline" className="ml-1">
                {stats.total}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="batches" className="gap-2" title="Press 5 to navigate">
              <span className="text-xs text-muted-foreground">5</span>
              <GraduationCap className="h-4 w-4" />
              <span className="hidden sm:inline">Batches</span>
              <Badge variant="outline" className="ml-1">
                {batches.length}
              </Badge>
            </TabsTrigger>
          </TabsList>
          <div className="hidden text-xs text-muted-foreground lg:block">
            Press 1-5 to switch tabs • ⌘E to export CSV
          </div>
        </div>

        {/* Tab Contents */}
        <TabsContent value="overview" className="mt-6">
          <OverviewTab
            duplicates={safeDuplicates}
            batches={safeBatches}
            studentsWithPayment={safeStudentsWithPayment}
          />
        </TabsContent>

        <TabsContent value="needs-attention" className="mt-6">
          <NeedsAttentionTab
            students={safeStudents}
            batches={safeBatches}
            studentsWithPayment={safeStudentsWithPayment}
          />
        </TabsContent>

        <TabsContent value="active" className="mt-6">
          <ActiveTab
            students={safeStudents}
            batches={safeBatches}
            studentsWithPayment={safeStudentsWithPayment}
          />
        </TabsContent>

        <TabsContent value="all" className="mt-6">
          <AllStudentsTab students={safeStudents} batches={safeBatches} />
        </TabsContent>

        <TabsContent value="batches" className="mt-6">
          <BatchesTab batches={safeBatches} students={safeStudents} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
