'use client'

import { useState, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  TrendingUp,
  DollarSign,
  Users,
  AlertTriangle,
  Keyboard,
  CreditCard,
  UserX,
  FileText,
  Activity,
} from 'lucide-react'
import type { Student } from '@prisma/client'
import type { StudentWithBatch } from '@/lib/db/queries/student'
import type { BatchWithCount } from '@/lib/types/batch'
import { exportMahadStudentsToCSV } from '@/lib/mahad-csv-export'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import { BillingStudentsTable } from '../components/billing-students-table'
import { useAdminKeyboardShortcuts, KeyboardShortcutHint } from '@/app/admin/hooks/use-keyboard-shortcuts'
import { StatCard, type StatVariant } from '@/components/admin/stats/stat-card'
import { spacing, typography, layouts, patterns } from '@/lib/design-tokens'
import { PageHeader } from '@/components/ui/typography'

interface BillingOverviewDashboardProps {
  studentsWithPayment: Student[]
  students: StudentWithBatch[]
  batches: BatchWithCount[]
}

export function BillingOverviewDashboard({
  studentsWithPayment,
  students,
  batches,
}: BillingOverviewDashboardProps) {
  const [activeTab, setActiveTab] = useState('overview')

  // Setup keyboard shortcuts
  useAdminKeyboardShortcuts({
    onTabChange: (tab) => {
      // Map number keys to tab names
      const tabMap: Record<string, string> = {
        'overview': 'overview',
        'tab-1': 'overview',
        'needs-attention': 'needs-attention',
        'tab-2': 'needs-attention',
        'past-due': 'past-due',
        'tab-3': 'past-due',
        'no-subscription': 'no-subscription',
        'tab-4': 'no-subscription',
      }
      const mappedTab = tabMap[tab] || tab
      if (mappedTab) {
        setActiveTab(mappedTab)
      }
    },
    onExportCSV: () => {
      handleExportCSV()
    },
  })

  // Calculate comprehensive stats
  const stats = {
    total: studentsWithPayment.length,
    active: studentsWithPayment.filter((s) => s.subscriptionStatus === 'active').length,
    needsAttention: studentsWithPayment.filter(
      (s) => s.subscriptionStatus !== 'active' && s.subscriptionStatus !== null
    ).length,
    incomplete: studentsWithPayment.filter(
      (s) => s.subscriptionStatus === 'incomplete'
    ).length,
    pastDue: studentsWithPayment.filter(
      (s) => s.subscriptionStatus === 'past_due'
    ).length,
    noSubscription: studentsWithPayment.filter(
      (s) => !s.stripeSubscriptionId
    ).length,
    canceled: studentsWithPayment.filter(
      (s) => s.subscriptionStatus === 'canceled'
    ).length,
    trialing: studentsWithPayment.filter(
      (s) => s.subscriptionStatus === 'trialing'
    ).length,
  }

  // Calculate health percentage
  const healthPercentage =
    stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0

  // Calculate estimated revenue (simplified - you may want to use actual payment data)
  const estimatedMonthlyRevenue = stats.active * 150 // Assuming $150 per active subscription

  // Handler for CSV export
  const handleExportCSV = () => {
    const filteredStudents = getFilteredStudents(activeTab)
    const filename = `billing-${activeTab}-${new Date().toISOString().split('T')[0]}`
    exportMahadStudentsToCSV(filteredStudents, filename)
  }

  // Filter students based on tab
  const getFilteredStudents = (tab: string) => {
    switch (tab) {
      case 'needs-attention':
        return students.filter((s) => {
          const payment = studentsWithPayment.find((sp) => sp.id === s.id)
          return payment?.subscriptionStatus !== 'active' && payment?.subscriptionStatus !== null
        })
      case 'past-due':
        return students.filter((s) => {
          const payment = studentsWithPayment.find((sp) => sp.id === s.id)
          return payment?.subscriptionStatus === 'past_due'
        })
      case 'no-subscription':
        return students.filter((s) => {
          const payment = studentsWithPayment.find((sp) => sp.id === s.id)
          return !payment?.stripeSubscriptionId
        })
      default:
        return students
    }
  }

  return (
    <div className={spacing.section}>
      {/* Modern Payment Health Hero Section */}
      <Card
        className={spacing.card.spacious}
      >
        <div className="relative space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <PageHeader
              title="Payment Health Dashboard"
              description={`${stats.total} students • ${batches.length} cohorts • $${(estimatedMonthlyRevenue).toLocaleString()}/mo`}
            />

            {/* Circular Health Indicator */}
            <div className="flex items-center gap-8">
              <div className="relative">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    className="text-gray-200 dark:text-gray-700"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 56}`}
                    strokeDashoffset={`${2 * Math.PI * 56 * (1 - healthPercentage / 100)}`}
                    className={`transition-all duration-1000 ${
                      healthPercentage >= 80 ? 'text-emerald-500' :
                      healthPercentage >= 60 ? 'text-amber-500' : 'text-red-500'
                    }`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-bold">{healthPercentage}%</span>
                  <span className="text-sm text-muted-foreground">Health Score</span>
                </div>
              </div>

              {/* Key Metrics */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Activity className="h-5 w-5 text-emerald-500" />
                  <span className="text-sm"><span className="font-semibold">{stats.active}</span> Active</span>
                </div>
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <span className="text-sm"><span className="font-semibold">{stats.needsAttention}</span> Need Attention</span>
                </div>
                <div className="flex items-center gap-3">
                  <UserX className="h-5 w-5 text-red-500" />
                  <span className="text-sm"><span className="font-semibold">{stats.noSubscription}</span> No Subscription</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Modern Stats Grid with new StatCard component */}
      <div className={layouts.statsGrid}>
        <StatCard
          title="Active Subscriptions"
          value={stats.active}
          icon={CheckCircle2}
          variant="success"
          description="Currently active"
          trend={{
            value: 5,
            direction: 'up',
            label: 'from last month'
          }}
          sparkline={[65, 68, 70, 67, 72, 75, 78]}
        />

        <StatCard
          title="Past Due"
          value={stats.pastDue}
          icon={AlertCircle}
          variant="error"
          description="Requires immediate action"
          trend={{
            value: 12,
            direction: 'up',
            label: 'from last month'
          }}
          action={{
            label: 'View Details',
            onClick: () => setActiveTab('past-due')
          }}
        />

        <StatCard
          title="Incomplete"
          value={stats.incomplete}
          icon={Clock}
          variant="warning"
          description="Pending payment setup"
          trend={{
            value: 3,
            direction: 'down',
            label: 'from last month'
          }}
        />

        <StatCard
          title="No Subscription"
          value={stats.noSubscription}
          icon={XCircle}
          variant="default"
          description="Not enrolled"
          trend={{
            value: 8,
            direction: 'neutral',
            label: 'from last month'
          }}
          action={{
            label: 'Enroll Now',
            onClick: () => setActiveTab('no-subscription')
          }}
        />
      </div>

      {/* Monthly Revenue Card */}
      <Card
        className={cn(spacing.card.default, "bg-gradient-to-br from-accent/10 to-accent/5")}
      >
        <div data-slot="content" className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-accent/10 p-4">
              <DollarSign className="h-8 w-8 text-accent-foreground" />
            </div>
            <div>
              <p className={typography.label.strong}>Monthly Recurring Revenue</p>
              <p className={typography.display.base}>
                ${estimatedMonthlyRevenue.toLocaleString()}
              </p>
              <p className={cn(typography.label.subtle, "mt-1")}>
                {stats.active} active × $150/mo average
              </p>
            </div>
          </div>
          <div className="text-right space-y-2">
            <Badge variant="success" className="gap-1">
              <TrendingUp className="h-3 w-3" />
              +12% MoM
            </Badge>
            <p className={typography.small}>Updated live</p>
          </div>
        </div>
      </Card>

      {/* Modern Tabbed Interface */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex items-center justify-between mb-6">
          <TabsList className="inline-flex h-12 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground grid-cols-4 w-auto">
            <TabsTrigger value="overview" className="gap-2 relative">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Overview</span>
              <kbd className="hidden lg:inline absolute -top-2 -right-2 text-[10px] px-1 py-0.5 bg-background/50 border rounded">1</kbd>
            </TabsTrigger>
            <TabsTrigger value="needs-attention" className="gap-2 relative">
              <AlertTriangle className="h-4 w-4" />
              <span className="hidden sm:inline">Needs Attention</span>
              {stats.needsAttention > 0 && (
                <Badge variant="destructive" className="ml-1">
                  {stats.needsAttention}
                </Badge>
              )}
              <kbd className="hidden lg:inline absolute -top-2 -right-2 text-[10px] px-1 py-0.5 bg-background/50 border rounded">2</kbd>
            </TabsTrigger>
            <TabsTrigger value="past-due" className="gap-2 relative">
              <AlertCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Past Due</span>
              {stats.pastDue > 0 && (
                <Badge variant="destructive" className="ml-1">
                  {stats.pastDue}
                </Badge>
              )}
              <kbd className="hidden lg:inline absolute -top-2 -right-2 text-[10px] px-1 py-0.5 bg-background/50 border rounded">3</kbd>
            </TabsTrigger>
            <TabsTrigger value="no-subscription" className="gap-2 relative">
              <XCircle className="h-4 w-4" />
              <span className="hidden sm:inline">No Subscription</span>
              {stats.noSubscription > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {stats.noSubscription}
                </Badge>
              )}
              <kbd className="hidden lg:inline absolute -top-2 -right-2 text-[10px] px-1 py-0.5 bg-background/50 border rounded">4</kbd>
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <KeyboardShortcutHint shortcut="mod+e" description="" />
          </div>
        </div>

        {/* Tab Contents */}
        <TabsContent value="overview" className="mt-6">
          <OverviewContent stats={stats} />
        </TabsContent>

        <TabsContent value="needs-attention" className="mt-6">
          <NeedsAttentionContent
            students={getFilteredStudents('needs-attention')}
            batches={batches}
          />
        </TabsContent>

        <TabsContent value="past-due" className="mt-6">
          <PastDueContent
            students={getFilteredStudents('past-due')}
            batches={batches}
          />
        </TabsContent>

        <TabsContent value="no-subscription" className="mt-6">
          <NoSubscriptionContent
            students={getFilteredStudents('no-subscription')}
            batches={batches}
          />
        </TabsContent>
      </Tabs>

      {/* Keyboard Shortcuts Hint */}
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground mt-6 pt-6 border-t">
        <span className="flex items-center gap-1">
          <Keyboard className="h-3 w-3" />
          Keyboard shortcuts available
        </span>
        <KeyboardShortcutHint shortcut="?" description="Show help" />
        <span className="hidden sm:inline">•</span>
        <KeyboardShortcutHint shortcut="alt+b" description="Billing" />
        <KeyboardShortcutHint shortcut="alt+s" description="Students" />
        <KeyboardShortcutHint shortcut="alt+c" description="Cohorts" />
      </div>
    </div>
  )
}

// Tab Content Components
function OverviewContent({ stats }: { stats: any }) {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Payment Status Breakdown</h3>
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm">Active Subscriptions</span>
              <span className="font-semibold">{stats.active}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Past Due</span>
              <span className="font-semibold text-red-600">{stats.pastDue}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Incomplete</span>
              <span className="font-semibold text-yellow-600">{stats.incomplete}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm">Canceled</span>
              <span className="font-semibold text-gray-600">{stats.canceled}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Trialing</span>
              <span className="font-semibold text-blue-600">{stats.trialing}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">No Subscription</span>
              <span className="font-semibold text-gray-600">{stats.noSubscription}</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

function NeedsAttentionContent({
  students,
  batches
}: {
  students: StudentWithBatch[]
  batches: Array<{ id: string; name: string }>
}) {
  if (students.length === 0) {
    return (
      <Card className="p-12 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-full bg-green-100 p-4 dark:bg-green-900">
            <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-lg font-semibold">All Payments Healthy</h3>
          <p className="text-muted-foreground">
            No students currently need payment attention.
          </p>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
          <div>
            <h3 className="font-semibold text-amber-900 dark:text-amber-100">
              Students Requiring Attention
            </h3>
            <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
              {students.length} student{students.length !== 1 ? 's' : ''} with incomplete, past due, or other payment issues.
            </p>
          </div>
        </div>
      </Card>
      <BillingStudentsTable
        students={students}
        actionType="review"
      />
    </div>
  )
}

function PastDueContent({
  students,
  batches
}: {
  students: StudentWithBatch[]
  batches: Array<{ id: string; name: string }>
}) {
  if (students.length === 0) {
    return (
      <Card className="p-12 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-full bg-green-100 p-4 dark:bg-green-900">
            <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-lg font-semibold">No Past Due Payments</h3>
          <p className="text-muted-foreground">
            All student payments are up to date.
          </p>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
          <div>
            <h3 className="font-semibold text-red-900 dark:text-red-100">
              Past Due Payments
            </h3>
            <p className="mt-1 text-sm text-red-800 dark:text-red-200">
              {students.length} student{students.length !== 1 ? 's' : ''} with overdue payments requiring immediate attention.
            </p>
          </div>
        </div>
      </Card>
      <BillingStudentsTable
        students={students}
        actionType="recover"
      />
    </div>
  )
}

function NoSubscriptionContent({
  students,
  batches
}: {
  students: StudentWithBatch[]
  batches: Array<{ id: string; name: string }>
}) {
  if (students.length === 0) {
    return (
      <Card className="p-12 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-full bg-green-100 p-4 dark:bg-green-900">
            <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-lg font-semibold">All Students Have Billing</h3>
          <p className="text-muted-foreground">
            Every student has an active subscription set up.
          </p>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="border-gray-300 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-start gap-3">
          <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-600" />
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              Missing Billing Setup
            </h3>
            <p className="mt-1 text-sm text-gray-800 dark:text-gray-200">
              {students.length} student{students.length !== 1 ? 's' : ''} without active subscriptions.
            </p>
          </div>
        </div>
      </Card>
      <BillingStudentsTable
        students={students}
        actionType="setup"
      />
    </div>
  )
}