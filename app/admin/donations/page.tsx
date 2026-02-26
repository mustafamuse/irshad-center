import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getDonations, getDonationStats } from '@/lib/db/queries/donation'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Donations | Admin Dashboard',
  description: 'View and manage donations.',
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default async function DonationsPage() {
  const [stats, { donations }] = await Promise.all([
    getDonationStats(),
    getDonations({ pageSize: 50 }),
  ])

  return (
    <div className="min-h-screen flex-1 space-y-6 bg-background p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Donations
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Overview of one-time and recurring donations
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              One-time Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCents(stats.oneTimeTotalCents)}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.oneTimeCount} donation{stats.oneTimeCount !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Monthly Recurring (MRR)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCents(stats.mrrCents)}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.activeRecurringCount} active subscription
              {stats.activeRecurringCount !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Donors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDonorCount}</div>
            <p className="text-xs text-muted-foreground">
              unique email addresses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Recurring Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.recurringPaymentCount}
            </div>
            <p className="text-xs text-muted-foreground">successful charges</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Donations</CardTitle>
        </CardHeader>
        <CardContent>
          {donations.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No donations yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Date</th>
                    <th className="pb-2 pr-4 font-medium">Donor</th>
                    <th className="pb-2 pr-4 font-medium">Amount</th>
                    <th className="pb-2 pr-4 font-medium">Type</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {donations.map((donation) => (
                    <tr key={donation.id} className="border-b last:border-0">
                      <td className="py-3 pr-4">
                        {formatDate(donation.createdAt)}
                      </td>
                      <td className="py-3 pr-4">
                        {donation.isAnonymous ? (
                          <span className="italic text-muted-foreground">
                            Anonymous
                          </span>
                        ) : (
                          <div>
                            {donation.donorName && (
                              <div className="font-medium">
                                {donation.donorName}
                              </div>
                            )}
                            {donation.donorEmail && (
                              <div className="text-xs text-muted-foreground">
                                {donation.donorEmail}
                              </div>
                            )}
                            {!donation.donorName && !donation.donorEmail && (
                              <span className="text-muted-foreground">--</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 pr-4 font-medium">
                        {formatCents(donation.amount)}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            donation.isRecurring
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                              : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          }`}
                        >
                          {donation.isRecurring ? 'Monthly' : 'One-time'}
                        </span>
                      </td>
                      <td className="py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            donation.status === 'succeeded'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : donation.status === 'pending'
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          }`}
                        >
                          {donation.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
