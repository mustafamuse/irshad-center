import { CheckCircle2, AlertCircle, Users, AlertTriangle } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import {
  getOrphanedSubscriptions,
  getPotentialMatches,
  type OrphanedSubscription,
} from '../actions'
import { SubscriptionsListClient } from './subscriptions-list-client'

export async function SubscriptionsListShell() {
  const result = await getOrphanedSubscriptions()

  // Show error alert if Stripe is not configured
  if (result.error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Unable to Load Subscriptions</AlertTitle>
        <AlertDescription>
          {result.error}
          <p className="mt-2 text-sm">
            Please ensure your Stripe environment variables are configured
            correctly.
          </p>
        </AlertDescription>
      </Alert>
    )
  }

  const orphanedSubs = result.data

  if (orphanedSubs.length === 0) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-8 text-center dark:border-green-800 dark:bg-green-950">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
          <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <h3 className="text-lg font-semibold text-green-900 dark:text-green-100">
          All Subscriptions Linked!
        </h3>
        <p className="mt-2 text-sm text-green-700 dark:text-green-300">
          There are no orphaned subscriptions. All active Stripe subscriptions
          are linked to students in the database.
        </p>
        <p className="mt-1 text-xs text-green-600 dark:text-green-400">
          Great job keeping everything organized!
        </p>
      </div>
    )
  }

  // Group subscriptions
  const singleSubsWithMatches = orphanedSubs.filter(
    (sub) => sub.subscriptionCount === 1 && sub.customerEmail
  )
  const multiSubs = orphanedSubs.filter((sub) => sub.subscriptionCount > 1)
  const noMatches = orphanedSubs.filter(
    (sub) => !sub.customerEmail || sub.subscriptionCount === 1
  )

  // Get potential matches for subscriptions with emails
  const subsWithMatches = await Promise.all(
    singleSubsWithMatches.map(async (sub) => {
      const matches = sub.customerEmail
        ? await getPotentialMatches(sub.customerEmail, sub.program)
        : []
      return { sub, matches }
    })
  )

  // Group multi-subscriptions by customer
  const multiSubsByCustomer = new Map<string, OrphanedSubscription[]>()
  for (const sub of multiSubs) {
    if (!multiSubsByCustomer.has(sub.customerId)) {
      multiSubsByCustomer.set(sub.customerId, [])
    }
    multiSubsByCustomer.get(sub.customerId)!.push(sub)
  }

  // Get potential matches for all multi-subscriptions
  const multiSubsMatchesMap = new Map<
    string,
    (typeof subsWithMatches)[0]['matches']
  >()
  for (const sub of multiSubs) {
    const matches = sub.customerEmail
      ? await getPotentialMatches(sub.customerEmail, sub.program)
      : []
    multiSubsMatchesMap.set(sub.id, matches)
  }

  const noMatchesWithMatches = noMatches.map((sub) => ({ sub, matches: [] }))

  return (
    <div className="space-y-6">
      <Alert className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
        <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertTitle className="text-blue-900 dark:text-blue-100">
          Quick Actions
        </AlertTitle>
        <AlertDescription className="text-blue-800 dark:text-blue-200">
          Review each subscription below and select the corresponding student
          from the dropdown. Click "Link Subscription" to connect them.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-4 gap-1 bg-muted p-1">
          <TabsTrigger
            value="all"
            className="flex flex-col items-center justify-center gap-1 rounded-md px-2 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm sm:flex-row sm:gap-2 sm:py-3"
          >
            <div className="flex items-center gap-1 sm:gap-2">
              <span className="text-xs font-medium sm:text-sm">All</span>
            </div>
            <Badge variant="default" className="h-5 text-xs">
              {orphanedSubs.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="easy"
            className="flex flex-col items-center justify-center gap-1 rounded-md px-2 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm sm:flex-row sm:gap-2 sm:py-3"
          >
            <div className="flex items-center gap-1 sm:gap-2">
              <CheckCircle2 className="h-3 w-3 shrink-0 sm:h-4 sm:w-4" />
              <span className="text-xs font-medium sm:text-sm">Easy</span>
            </div>
            <Badge
              variant={subsWithMatches.length > 0 ? 'default' : 'secondary'}
              className="h-5 text-xs"
            >
              {subsWithMatches.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="multi"
            className="flex flex-col items-center justify-center gap-1 rounded-md px-2 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm sm:flex-row sm:gap-2 sm:py-3"
          >
            <div className="flex items-center gap-1 sm:gap-2">
              <Users className="h-3 w-3 shrink-0 sm:h-4 sm:w-4" />
              <span className="text-xs font-medium sm:text-sm">Multi</span>
            </div>
            <Badge
              variant={multiSubsByCustomer.size > 0 ? 'default' : 'secondary'}
              className="h-5 text-xs"
            >
              {multiSubsByCustomer.size}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="manual"
            className="flex flex-col items-center justify-center gap-1 rounded-md px-2 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm sm:flex-row sm:gap-2 sm:py-3"
          >
            <div className="flex items-center gap-1 sm:gap-2">
              <AlertCircle className="h-3 w-3 shrink-0 sm:h-4 sm:w-4" />
              <span className="whitespace-nowrap text-xs font-medium sm:text-sm">
                Manual
              </span>
            </div>
            <Badge
              variant={
                noMatchesWithMatches.length > 0 ? 'default' : 'secondary'
              }
              className="h-5 text-xs"
            >
              {noMatchesWithMatches.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <SubscriptionsListClient
            subsWithMatches={subsWithMatches}
            multiSubsByCustomer={multiSubsByCustomer}
            multiSubsMatchesMap={multiSubsMatchesMap}
            noMatchesWithMatches={noMatchesWithMatches}
            allSubscriptions={orphanedSubs}
          />
        </TabsContent>

        <TabsContent value="easy" className="mt-6">
          <SubscriptionsListClient
            subsWithMatches={subsWithMatches}
            multiSubsByCustomer={new Map()}
            multiSubsMatchesMap={new Map()}
            noMatchesWithMatches={[]}
            allSubscriptions={orphanedSubs}
          />
        </TabsContent>

        <TabsContent value="multi" className="mt-6">
          <SubscriptionsListClient
            subsWithMatches={[]}
            multiSubsByCustomer={multiSubsByCustomer}
            multiSubsMatchesMap={multiSubsMatchesMap}
            noMatchesWithMatches={[]}
            allSubscriptions={orphanedSubs}
          />
        </TabsContent>

        <TabsContent value="manual" className="mt-6">
          <SubscriptionsListClient
            subsWithMatches={[]}
            multiSubsByCustomer={new Map()}
            multiSubsMatchesMap={new Map()}
            noMatchesWithMatches={noMatchesWithMatches}
            allSubscriptions={orphanedSubs}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
