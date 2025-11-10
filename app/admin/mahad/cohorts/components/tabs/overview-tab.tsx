import type { Student } from '@prisma/client'
import { Card } from '@/components/ui/card'
import { AlertCircle, TrendingUp, Users, GraduationCap } from 'lucide-react'
import { DuplicateDetector } from '../duplicate-detection'

interface OverviewTabProps {
  duplicates: Array<{ name: string; students: Student[] }>
  batches: Array<{ id: string; name: string }>
  studentsWithPayment: Student[]
}

export function OverviewTab({
  duplicates,
  batches,
  studentsWithPayment,
}: OverviewTabProps) {
  const stats = {
    totalStudents: studentsWithPayment.length,
    totalBatches: batches.length,
    activeSubscriptions: studentsWithPayment.filter(
      (s) => s.subscriptionStatus === 'active'
    ).length,
  }

  return (
    <div className="space-y-6">
      {/* Quick Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-blue-100 p-3 dark:bg-blue-900">
              <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Total Students
              </p>
              <p className="text-2xl font-bold">{stats.totalStudents}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-green-100 p-3 dark:bg-green-900">
              <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Active Subscriptions
              </p>
              <p className="text-2xl font-bold">{stats.activeSubscriptions}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-purple-100 p-3 dark:bg-purple-900">
              <GraduationCap className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Total Cohorts
              </p>
              <p className="text-2xl font-bold">{stats.totalBatches}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Duplicate Detection */}
      {duplicates.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <h3 className="text-lg font-semibold">Attention Required</h3>
          </div>
          <DuplicateDetector duplicates={duplicates as any} />
        </div>
      ) : (
        <Card className="p-8 text-center">
          <div className="flex flex-col items-center gap-2">
            <div className="rounded-full bg-green-100 p-3 dark:bg-green-900">
              <AlertCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="font-semibold">No Issues Detected</h3>
            <p className="text-sm text-muted-foreground">
              All student records look good!
            </p>
          </div>
        </Card>
      )}

      {/* Recent Activity Placeholder */}
      <Card className="p-6">
        <h3 className="mb-4 font-semibold">Quick Actions</h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>• Switch to "Needs Attention" tab to see students requiring action</p>
          <p>• Visit "Batches" tab to manage cohorts and assignments</p>
          <p>• Check "All Students" tab for comprehensive student management</p>
        </div>
      </Card>
    </div>
  )
}
