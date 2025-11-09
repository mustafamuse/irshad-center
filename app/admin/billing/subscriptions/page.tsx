import { Metadata } from 'next'
import { Card } from '@/components/ui/card'
import Link from 'next/link'
import { CreditCard, Link2, AlertCircle, TrendingDown, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getStudentsWithPaymentInfo, getStudentsWithBatch } from '@/lib/db/queries/student'
import { getBatches } from '@/lib/db/queries/batch'
import { Badge } from '@/components/ui/badge'
import { BillingStudentsTable } from '../components/billing-students-table'

export const metadata: Metadata = {
  title: 'Subscriptions | Billing',
  description: 'Manage active subscriptions and subscription linking',
}

export default async function SubscriptionsPage() {
  // Fetch subscription data
  const [studentsWithPayment, students, batches] = await Promise.all([
    getStudentsWithPaymentInfo(),
    getStudentsWithBatch(),
    getBatches(),
  ])

  // Calculate subscription stats
  const activeSubscriptions = studentsWithPayment.filter(s => s.subscriptionStatus === 'active')
  const atRiskSubscriptions = studentsWithPayment.filter(s =>
    s.subscriptionStatus === 'past_due' ||
    s.subscriptionStatus === 'incomplete' ||
    s.subscriptionStatus === 'unpaid'
  )
  const canceledSubscriptions = studentsWithPayment.filter(s => s.subscriptionStatus === 'canceled')
  const trialingSubscriptions = studentsWithPayment.filter(s => s.subscriptionStatus === 'trialing')

  // Get students with subscription IDs for display
  const studentsWithSubscriptions = students.filter(s =>
    studentsWithPayment.find(sp => sp.id === s.id && sp.stripeSubscriptionId)
  )

  const monthlyRevenue = activeSubscriptions.reduce((sum, s) => sum + (s.monthlyRate || 150), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Subscription Management
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            View and manage active subscriptions
          </p>
        </div>
        <Link href="/admin/billing/subscriptions/link">
          <Button variant="outline" className="gap-2">
            <Link2 className="h-4 w-4" />
            Link Subscriptions
          </Button>
        </Link>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeSubscriptions.length}</p>
              <p className="text-sm text-muted-foreground">Active Subscriptions</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            ${monthlyRevenue.toLocaleString()}/month revenue
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-lg bg-yellow-100 p-2 dark:bg-yellow-900">
              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{atRiskSubscriptions.length}</p>
              <p className="text-sm text-muted-foreground">At Risk</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Subscriptions with payment issues
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-lg bg-red-100 p-2 dark:bg-red-900">
              <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{canceledSubscriptions.length}</p>
              <p className="text-sm text-muted-foreground">Canceled</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Recently canceled subscriptions
          </p>
        </Card>

        <Card className="p-6 border-dashed">
          <Link href="/admin/billing/subscriptions/link">
            <div className="flex items-center gap-3 mb-4 cursor-pointer hover:opacity-80">
              <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900">
                <Link2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-lg font-semibold">Link Subscriptions</p>
                <p className="text-sm text-muted-foreground">Match orphaned subscriptions</p>
              </div>
            </div>
          </Link>
        </Card>
      </div>

      {/* Subscription List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">All Subscriptions</h3>
          <div className="flex gap-2">
            <Badge variant="outline">
              {studentsWithSubscriptions.length} total
            </Badge>
            <Badge className="bg-green-100 text-green-800">
              {activeSubscriptions.length} active
            </Badge>
            {atRiskSubscriptions.length > 0 && (
              <Badge variant="destructive">
                {atRiskSubscriptions.length} at risk
              </Badge>
            )}
          </div>
        </div>

        {studentsWithSubscriptions.length > 0 ? (
          <BillingStudentsTable
            students={studentsWithSubscriptions}
            showPaymentStatus={true}
            actionType="review"
          />
        ) : (
          <Card className="p-12 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-full bg-gray-100 p-4 dark:bg-gray-800">
                <CreditCard className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold">No Active Subscriptions</h3>
              <p className="text-muted-foreground max-w-md">
                No students currently have active subscriptions set up. Visit the student directory
                to set up billing for new students.
              </p>
              <Link href="/admin/students/mahad">
                <Button variant="outline" className="mt-2">
                  Go to Student Directory
                </Button>
              </Link>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}