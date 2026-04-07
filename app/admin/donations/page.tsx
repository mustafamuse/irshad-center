import { type Metadata } from 'next'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getCachedDonationStats, getDonations } from '@/lib/db/queries/donation'
import { formatCurrency, formatDate } from '@/lib/utils/formatters'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Donations | Admin Dashboard',
  description: 'View and manage donations.',
}

const BADGE_BASE =
  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium'

function getTypeBadgeClass(isRecurring: boolean): string {
  if (isRecurring) {
    return `${BADGE_BASE} bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400`
  }
  return `${BADGE_BASE} bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400`
}

function getStatusBadgeClass(status: string): string {
  if (status === 'succeeded') {
    return `${BADGE_BASE} bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400`
  }
  if (status === 'pending') {
    return `${BADGE_BASE} bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400`
  }
  return `${BADGE_BASE} bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400`
}

function pluralize(count: number, singular: string): string {
  return `${count} ${singular}${count !== 1 ? 's' : ''}`
}

export default async function DonationsPage() {
  const [stats, { donations }] = await Promise.all([
    getCachedDonationStats(),
    getDonations({ pageSize: 50 }),
  ])

  const statCards = [
    {
      title: 'One-time Total',
      value: formatCurrency(stats.oneTimeTotalCents),
      subtitle: pluralize(stats.oneTimeCount, 'donation'),
    },
    {
      title: 'Monthly Recurring (MRR)',
      value: formatCurrency(stats.mrrCents),
      subtitle: pluralize(stats.activeRecurringCount, 'active subscription'),
    },
    {
      title: 'Total Donors',
      value: stats.totalDonorCount,
      subtitle: 'unique email addresses',
    },
    {
      title: 'Recurring Payments',
      value: stats.recurringPaymentCount,
      subtitle: 'successful charges',
    },
  ]

  return (
    <main className="container mx-auto space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Donations
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Overview of one-time and recurring donations
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground">{card.subtitle}</p>
            </CardContent>
          </Card>
        ))}
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
                        <DonorCell
                          isAnonymous={donation.isAnonymous}
                          name={donation.donorName}
                          email={donation.donorEmail}
                        />
                      </td>
                      <td className="py-3 pr-4 font-medium">
                        {formatCurrency(donation.amount)}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={getTypeBadgeClass(donation.isRecurring)}
                        >
                          {donation.isRecurring ? 'Monthly' : 'One-time'}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className={getStatusBadgeClass(donation.status)}>
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
    </main>
  )
}

interface DonorCellProps {
  isAnonymous: boolean
  name: string | null
  email: string | null
}

function DonorCell({ isAnonymous, name, email }: DonorCellProps) {
  if (isAnonymous) {
    return <span className="italic text-muted-foreground">Anonymous</span>
  }

  if (!name && !email) {
    return <span className="text-muted-foreground">--</span>
  }

  return (
    <div>
      {name && <div className="font-medium">{name}</div>}
      {email && <div className="text-xs text-muted-foreground">{email}</div>}
    </div>
  )
}
