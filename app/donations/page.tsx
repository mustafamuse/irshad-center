import { Suspense } from 'react'

import Image from 'next/image'

import { fromZonedTime, toZonedTime } from 'date-fns-tz'
import { type Metadata } from 'next'

import { Card, CardContent } from '@/components/ui/card'
import { SCHOOL_TIMEZONE } from '@/lib/constants/teacher-checkin'
import { prisma } from '@/lib/db'
import { getDonations } from '@/lib/db/queries/donation'
import { formatCurrency, formatDate } from '@/lib/utils/formatters'

import { AnimatedStat } from './_components/animated-stat'
import { PeriodFilter, type DonationPeriod } from './_components/period-filter'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Donation Campaign | Irshad Center',
  description:
    'See our monthly supporters and join the Irshad Center donation campaign.',
}

const periodLabels: Record<DonationPeriod, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  thisWeek: 'This Week',
}

function getDonationDateRange(period: DonationPeriod): {
  start: Date
  end: Date
} {
  const zonedNow = toZonedTime(new Date(), SCHOOL_TIMEZONE)
  const todayLocal = new Date(
    zonedNow.getFullYear(),
    zonedNow.getMonth(),
    zonedNow.getDate()
  )
  const DAY_MS = 24 * 60 * 60 * 1000

  let localStart: Date
  let localEnd: Date

  switch (period) {
    case 'today':
      localStart = todayLocal
      localEnd = new Date(todayLocal.getTime() + DAY_MS)
      break
    case 'yesterday':
      localStart = new Date(todayLocal.getTime() - DAY_MS)
      localEnd = todayLocal
      break
    case 'thisWeek': {
      const dayOfWeek = todayLocal.getDay()
      localStart = new Date(todayLocal.getTime() - dayOfWeek * DAY_MS)
      localEnd = new Date(todayLocal.getTime() + DAY_MS)
      break
    }
  }

  return {
    start: fromZonedTime(localStart, SCHOOL_TIMEZONE),
    end: fromZonedTime(localEnd, SCHOOL_TIMEZONE),
  }
}

function isValidPeriod(value: string | undefined): value is DonationPeriod {
  return value === 'today' || value === 'yesterday' || value === 'thisWeek'
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function DonationsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const rawPeriod =
    typeof params.period === 'string' ? params.period : undefined
  const period: DonationPeriod = isValidPeriod(rawPeriod) ? rawPeriod : 'today'
  const { start, end } = getDonationDateRange(period)

  const hiddenDonors = ['mustafamuse']

  const periodWhere = {
    isRecurring: true,
    status: 'succeeded' as const,
    createdAt: { gte: start, lt: end },
    NOT: [
      { stripePaymentIntentId: { startsWith: 'sub_setup_' } },
      { stripePaymentIntentId: { startsWith: 'sub_cancelled_' } },
      ...hiddenDonors.map((name) => ({
        donorName: { equals: name, mode: 'insensitive' as const },
      })),
    ],
  }

  const [{ donations: allDonations }, stats] = await Promise.all([
    getDonations({
      pageSize: 50,
      isRecurring: true,
      dateFrom: start,
      dateTo: end,
    }),
    prisma.donation.aggregate({
      where: periodWhere,
      _count: true,
      _sum: { amount: true },
    }),
  ])

  const donations = allDonations.filter(
    (d) =>
      !hiddenDonors.some(
        (name) => d.donorName?.toLowerCase() === name.toLowerCase()
      )
  )

  const donatorCount = stats._count
  const totalAmountCents = stats._sum.amount ?? 0

  return (
    <main className="min-h-screen bg-white">
      <div className="container mx-auto max-w-4xl px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="mb-8 text-center sm:mb-12">
          <Image
            src="/images/irshad-logo-cropped.svg"
            alt="Irshad Center"
            width={500}
            height={500}
            className="mx-auto mb-6 h-48 w-auto sm:h-72"
            priority
          />
          <h1 className="text-3xl font-bold tracking-tight text-[#007078] sm:text-4xl">
            Sadaqa Jariyah Campaign
          </h1>
          <p className="mt-2 text-base text-muted-foreground sm:text-lg">
            Join our community of monthly supporters
          </p>
        </div>

        {/* Period Filter */}
        <div className="mb-6 flex justify-center">
          <Suspense>
            <PeriodFilter />
          </Suspense>
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:mb-12 sm:gap-4">
          <Card className="border-[#007078]/20">
            <CardContent className="p-4 text-center sm:p-6">
              <p className="text-sm font-medium text-muted-foreground">
                New Donators
              </p>
              <p className="mt-1 text-3xl font-bold text-[#007078] sm:text-4xl">
                <AnimatedStat value={donatorCount} />
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {periodLabels[period].toLowerCase()}
              </p>
            </CardContent>
          </Card>
          <Card className="border-[#007078]/20">
            <CardContent className="p-4 text-center sm:p-6">
              <p className="text-sm font-medium text-muted-foreground">
                Amount Donated
              </p>
              <p className="mt-1 text-3xl font-bold text-[#007078] sm:text-4xl">
                <AnimatedStat value={totalAmountCents} format="dollars" />
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {periodLabels[period].toLowerCase()}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Join CTA */}
        <div className="mb-8 flex flex-col items-center text-center sm:mb-12">
          <Image
            src="/images/donate-qr.png"
            alt="Scan to donate"
            width={180}
            height={180}
            className="mb-3 h-36 w-36 sm:h-44 sm:w-44"
          />
          <p className="text-lg font-medium text-muted-foreground">
            Scan or visit{' '}
            <span className="font-bold text-[#007078]">
              irshadcenter.com/donate
            </span>
          </p>
        </div>

        {/* Donation List */}
        <div>
          <h2 className="mb-4 text-lg font-semibold text-foreground sm:text-xl">
            {periodLabels[period]}&apos;s Monthly Donations
          </h2>

          {donations.length === 0 ? (
            <Card className="border-[#007078]/20">
              <CardContent className="py-12 text-center text-muted-foreground">
                No monthly donations {periodLabels[period].toLowerCase()}. Be
                the first!
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Mobile: card layout */}
              <div className="space-y-3 sm:hidden">
                {donations.map((donation) => (
                  <Card key={donation.id} className="border-[#007078]/10">
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="min-w-0 flex-1">
                        <DonorDisplay
                          isAnonymous={donation.isAnonymous}
                          name={donation.donorName}
                        />
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatDate(donation.createdAt)}
                        </p>
                      </div>
                      <div className="ml-4 text-right">
                        <p className="text-lg font-bold text-[#007078]">
                          {formatCurrency(donation.amount)}
                        </p>
                        <p className="text-xs text-muted-foreground">/month</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Desktop: table layout */}
              <Card className="hidden border-[#007078]/10 sm:block">
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="px-6 py-3 font-medium">Supporter</th>
                        <th className="px-6 py-3 font-medium">Date</th>
                        <th className="px-6 py-3 text-right font-medium">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {donations.map((donation) => (
                        <tr
                          key={donation.id}
                          className="border-b last:border-0"
                        >
                          <td className="px-6 py-4">
                            <DonorDisplay
                              isAnonymous={donation.isAnonymous}
                              name={donation.donorName}
                            />
                          </td>
                          <td className="px-6 py-4 text-muted-foreground">
                            {formatDate(donation.createdAt)}
                          </td>
                          <td className="px-6 py-4 text-right font-medium text-[#007078]">
                            {formatCurrency(donation.amount)}/mo
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </main>
  )
}

function DonorDisplay({
  isAnonymous,
  name,
}: {
  isAnonymous: boolean
  name: string | null
}) {
  if (isAnonymous || !name) {
    return (
      <span className="text-sm italic text-muted-foreground">
        Anonymous Supporter
      </span>
    )
  }
  return <span className="text-sm font-medium">{name}</span>
}
