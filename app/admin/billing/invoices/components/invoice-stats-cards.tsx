import { Card } from '@/components/ui/card'
import {
  DollarSign,
  TrendingUp,
  Receipt,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react'
import { prisma } from '@/lib/db'
import { stripeServerClient as stripe } from '@/lib/stripe'
import { getStudentsWithPaymentInfo } from '@/lib/db/queries/student'

export async function InvoiceStatsCards() {
  // Fetch current payment data from database
  const studentsWithPayment = await getStudentsWithPaymentInfo()

  // Calculate current month and last month dates
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()
  const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1
  const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear

  // Fetch payment records for current and last month
  const [currentMonthPayments, lastMonthPayments, allPayments] = await Promise.all([
    prisma.studentPayment.findMany({
      where: {
        year: currentYear,
        month: currentMonth,
      },
    }),
    prisma.studentPayment.findMany({
      where: {
        year: lastMonthYear,
        month: lastMonth,
      },
    }),
    prisma.studentPayment.findMany({
      where: {
        year: currentYear,
      },
    }),
  ])

  // Calculate invoice stats
  const totalInvoicesCount = allPayments.length
  const paidInvoicesCount = allPayments.filter(p => p.paidAt).length
  const unpaidInvoicesCount = studentsWithPayment.filter(
    s => s.subscriptionStatus === 'past_due' || s.subscriptionStatus === 'unpaid'
  ).length
  const overdueInvoicesCount = studentsWithPayment.filter(
    s => s.subscriptionStatus === 'past_due'
  ).length

  // Calculate revenue
  const currentMonthRevenue = currentMonthPayments.reduce((sum, p) => sum + p.amountPaid, 0)
  const lastMonthRevenue = lastMonthPayments.reduce((sum, p) => sum + p.amountPaid, 0)
  const yearToDateRevenue = allPayments.reduce((sum, p) => sum + p.amountPaid, 0)

  // Calculate collection rate
  const collectionRate = totalInvoicesCount > 0
    ? Math.round((paidInvoicesCount / totalInvoicesCount) * 100)
    : 0

  // Calculate average invoice value
  const averageInvoiceValue = paidInvoicesCount > 0
    ? Math.round(yearToDateRevenue / paidInvoicesCount)
    : 0

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Total Revenue Card */}
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900">
            <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-2xl font-bold">
              ${(currentMonthRevenue / 100).toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground">This Month</p>
            <p className="text-xs text-muted-foreground mt-1">
              {lastMonthRevenue > 0 && (
                <span className={currentMonthRevenue > lastMonthRevenue ? 'text-green-600' : 'text-red-600'}>
                  {currentMonthRevenue > lastMonthRevenue ? '↑' : '↓'}
                  {Math.abs(Math.round(((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100))}%
                </span>
              )}
              {lastMonthRevenue > 0 && ' vs last month'}
            </p>
          </div>
        </div>
      </Card>

      {/* YTD Revenue Card */}
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900">
            <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-2xl font-bold">
              ${(yearToDateRevenue / 100).toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground">YTD Revenue</p>
            <p className="text-xs text-muted-foreground mt-1">
              Avg ${(averageInvoiceValue / 100).toLocaleString()} per invoice
            </p>
          </div>
        </div>
      </Card>

      {/* Collection Rate Card */}
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-purple-100 p-2 dark:bg-purple-900">
            <CheckCircle className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <p className="text-2xl font-bold">{collectionRate}%</p>
            <p className="text-sm text-muted-foreground">Collection Rate</p>
            <p className="text-xs text-muted-foreground mt-1">
              {paidInvoicesCount} of {totalInvoicesCount} paid
            </p>
          </div>
        </div>
      </Card>

      {/* Outstanding Invoices Card */}
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-amber-100 p-2 dark:bg-amber-900">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-2xl font-bold">{unpaidInvoicesCount}</p>
            <p className="text-sm text-muted-foreground">Unpaid</p>
            <p className="text-xs text-muted-foreground mt-1">
              {overdueInvoicesCount > 0 && (
                <span className="text-red-600">
                  {overdueInvoicesCount} overdue
                </span>
              )}
              {overdueInvoicesCount === 0 && 'All current'}
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}