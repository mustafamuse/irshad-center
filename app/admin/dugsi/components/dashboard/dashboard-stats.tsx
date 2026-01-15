'use client'

import {
  AlertCircle,
  DollarSign,
  RotateCcw,
  TrendingDown,
  UserCheck,
  Users,
} from 'lucide-react'

import { StatsCard } from '@/components/admin'
import { cn } from '@/lib/utils'

import { DugsiRegistration, TabValue } from '../../_types'
import { getBillingStatus } from '../../_utils/billing'
import { groupRegistrationsByFamily } from '../../_utils/family'

interface DugsiStatsProps {
  registrations: DugsiRegistration[]
  onStatClick?: (tab: TabValue) => void
}

export function DugsiStats({ registrations, onStatClick }: DugsiStatsProps) {
  const families = groupRegistrationsByFamily(registrations)

  const totalFamilies = families.length
  const totalStudents = registrations.length
  const payingFamilies = families.filter((f) => f.hasSubscription).length
  const churnedFamilies = families.filter(
    (f) => f.hasChurned && !f.hasSubscription
  ).length
  const noPaymentFamilies = families.filter(
    (f) => !f.hasPayment && !f.hasChurned
  ).length
  const payingRate =
    totalFamilies > 0 ? Math.round((payingFamilies / totalFamilies) * 100) : 0

  const monthlyRevenue = families
    .filter((f) => f.hasSubscription)
    .reduce((sum, family) => {
      const activeStudent = family.members.find(
        (m) => m.subscriptionStatus === 'active' && m.subscriptionAmount
      )
      return sum + (activeStudent?.subscriptionAmount ?? 0)
    }, 0)

  const formattedRevenue = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(monthlyRevenue / 100)

  const revenueStats = families.reduce(
    (acc, family) => {
      if (!family.hasSubscription) return acc

      const member = family.members[0]
      if (!member) return acc

      const billing = getBillingStatus(member)
      acc.expected += billing.expected
      acc.actual += billing.actual ?? 0
      if (billing.status !== 'match' && billing.status !== 'no-subscription') {
        acc.mismatchCount++
      }

      return acc
    },
    { expected: 0, actual: 0, mismatchCount: 0 }
  )

  const variance = revenueStats.actual - revenueStats.expected

  const varianceColors =
    variance === 0
      ? {
          bar: 'bg-gray-200',
          bg: 'bg-gray-100',
          text: 'text-muted-foreground',
          value: '',
        }
      : variance < 0
        ? {
            bar: 'bg-red-500',
            bg: 'bg-red-100',
            text: 'text-red-600',
            value: 'text-red-600',
          }
        : {
            bar: 'bg-green-500',
            bg: 'bg-green-100',
            text: 'text-green-600',
            value: 'text-green-600',
          }

  const varianceValue =
    variance === 0
      ? '$0'
      : `${variance < 0 ? '-' : '+'}$${Math.abs(variance / 100).toFixed(0)}`

  return (
    <div className="mx-auto grid max-w-screen-2xl gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <StatsCard
        title="Families"
        value={totalFamilies}
        description={`${totalStudents} total students`}
        icon={Users}
        topBarClassName="bg-teal-700"
        iconClassName="bg-teal-700/10 text-teal-700"
        onClick={() => onStatClick?.('all')}
      />

      <StatsCard
        title="Enrolled & Paying"
        value={payingFamilies}
        description={`${payingRate}% of families`}
        icon={UserCheck}
        topBarClassName="bg-green-500"
        iconClassName="bg-green-100 text-green-600"
        valueClassName="text-green-600"
        onClick={() => onStatClick?.('active')}
      />

      <StatsCard
        title="No Payment"
        value={noPaymentFamilies}
        description="Send payment link"
        icon={AlertCircle}
        topBarClassName={noPaymentFamilies > 0 ? 'bg-amber-500' : 'bg-gray-200'}
        iconClassName={
          noPaymentFamilies > 0
            ? 'bg-amber-100 text-amber-600'
            : 'bg-gray-100 text-muted-foreground'
        }
        valueClassName={noPaymentFamilies > 0 ? 'text-amber-600' : ''}
        highlight={noPaymentFamilies > 0}
        onClick={() => onStatClick?.('needs-attention')}
      />

      <StatsCard
        title="Churned"
        value={churnedFamilies}
        description="Win back opportunity"
        icon={RotateCcw}
        topBarClassName={churnedFamilies > 0 ? 'bg-gray-500' : 'bg-gray-200'}
        iconClassName={
          churnedFamilies > 0
            ? 'bg-gray-100 text-gray-600'
            : 'bg-gray-100 text-muted-foreground'
        }
        valueClassName={churnedFamilies > 0 ? 'text-gray-600' : ''}
        highlight={churnedFamilies > 0}
        onClick={() => onStatClick?.('churned')}
      />

      <StatsCard
        title="Monthly Revenue"
        value={formattedRevenue}
        description={`From ${payingFamilies} families`}
        icon={DollarSign}
        topBarClassName="bg-blue-500"
        iconClassName="bg-blue-100 text-blue-600"
      />

      <StatsCard
        title="Revenue Variance"
        value={varianceValue}
        description={
          revenueStats.mismatchCount === 0
            ? 'All families paying correct amount'
            : `${revenueStats.mismatchCount} ${revenueStats.mismatchCount === 1 ? 'family' : 'families'} mismatched`
        }
        icon={TrendingDown}
        topBarClassName={varianceColors.bar}
        iconClassName={cn('rounded-lg', varianceColors.bg, varianceColors.text)}
        valueClassName={varianceColors.value}
        onClick={
          revenueStats.mismatchCount > 0
            ? () => onStatClick?.('billing-mismatch')
            : undefined
        }
      />
    </div>
  )
}
