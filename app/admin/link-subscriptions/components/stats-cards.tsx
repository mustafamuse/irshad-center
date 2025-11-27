import { AlertTriangle } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

import { getOrphanedSubscriptions } from '../actions'
import { StatsCardsClient } from './stats-cards-client'

export async function StatsCards() {
  const result = await getOrphanedSubscriptions()

  // Show error alert if Stripe is not configured
  if (result.error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Configuration Error</AlertTitle>
        <AlertDescription>{result.error}</AlertDescription>
      </Alert>
    )
  }

  const orphanedSubs = result.data
  const totalOrphaned = orphanedSubs.length
  const multiSubCustomers = orphanedSubs.filter(
    (sub) => sub.subscriptionCount > 1
  )
  const uniqueMultiSubCustomers = new Set(
    multiSubCustomers.map((sub) => sub.customerId)
  ).size
  const mahadCount = orphanedSubs.filter(
    (sub) => sub.program === 'MAHAD'
  ).length
  const dugsiCount = orphanedSubs.filter(
    (sub) => sub.program === 'DUGSI'
  ).length

  const totalRevenue =
    orphanedSubs.reduce((sum, sub) => sum + sub.amount, 0) / 100 // Convert cents to dollars

  return (
    <StatsCardsClient
      totalOrphaned={totalOrphaned}
      uniqueMultiSubCustomers={uniqueMultiSubCustomers}
      totalRevenue={totalRevenue}
      mahadCount={mahadCount}
      dugsiCount={dugsiCount}
    />
  )
}
