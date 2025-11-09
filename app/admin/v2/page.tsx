import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { StudentActivityTable } from "@/components/student-activity-table"
import { SectionCards } from "@/components/section-cards"
import {
  getDashboardStats,
  getPaymentTrends,
  getRecentActivity,
} from "@/lib/db/queries/dashboard"

export default async function AdminV2DashboardPage() {
  // Fetch all dashboard data in parallel
  const [stats, paymentTrends, recentActivity] = await Promise.all([
    getDashboardStats(),
    getPaymentTrends(90), // Last 90 days
    getRecentActivity(100), // Last 100 students
  ])

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <SectionCards stats={stats} />
          <div className="px-4 lg:px-6">
            <ChartAreaInteractive data={paymentTrends} />
          </div>
          <div className="px-4 lg:px-6">
            <div className="rounded-lg border bg-card p-6">
              <h2 className="mb-4 text-xl font-semibold">Recent Student Activity</h2>
              <StudentActivityTable data={recentActivity} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}