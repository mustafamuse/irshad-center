import { CheckCircle2, AlertCircle, Users } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import {
  getOrphanedSubscriptions,
  getPotentialMatches,
  type OrphanedSubscription,
} from '../actions'
import { MultiSubscriptionCard } from './multi-subscription-card'
import { SubscriptionCard } from './subscription-card'

export async function SubscriptionsListShell() {
  const orphanedSubs = await getOrphanedSubscriptions()

  if (orphanedSubs.length === 0) {
    return (
      <Alert className="border-green-200 bg-green-50">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-green-900">
          All Subscriptions Linked!
        </AlertTitle>
        <AlertDescription className="text-green-700">
          There are no orphaned subscriptions. All active Stripe subscriptions
          are linked to students in the database.
        </AlertDescription>
      </Alert>
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

      <Tabs defaultValue="easy" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-3 gap-1 bg-muted p-1">
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

        <TabsContent value="easy" className="mt-6 space-y-4">
          {subsWithMatches.length === 0 ? (
            <Alert>
              <AlertDescription>
                No easy matches found. Check the other tabs for subscriptions
                that need manual review.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="rounded-lg border bg-muted/50 p-4">
                <p className="text-sm font-medium text-foreground">
                  These subscriptions have customer emails that match students
                  in the database.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  The matching student will be pre-selected in the dropdown for
                  quick linking.
                </p>
              </div>
              {subsWithMatches.map(({ sub, matches }) => (
                <SubscriptionCard
                  key={sub.id}
                  subscription={sub}
                  potentialMatches={matches}
                />
              ))}
            </>
          )}
        </TabsContent>

        <TabsContent value="multi" className="mt-6 space-y-4">
          {multiSubsByCustomer.size === 0 ? (
            <Alert>
              <AlertDescription>
                No customers with multiple subscriptions found.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <Alert className="border-yellow-200 bg-yellow-50">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <AlertTitle className="text-yellow-900">
                  Multiple Subscriptions
                </AlertTitle>
                <AlertDescription className="text-yellow-700">
                  These customers have multiple subscriptions. They may be
                  paying for themselves and other students. Link each
                  subscription to the correct student.
                </AlertDescription>
              </Alert>
              {Array.from(multiSubsByCustomer.entries()).map(
                ([customerId, subs]) => (
                  <MultiSubscriptionCard
                    key={customerId}
                    customerId={customerId}
                    customerEmail={subs[0].customerEmail || ''}
                    customerName={subs[0].customerName || 'No Name'}
                    subscriptions={subs}
                    potentialMatchesMap={multiSubsMatchesMap}
                  />
                )
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="manual" className="mt-6 space-y-4">
          {noMatchesWithMatches.length === 0 ? (
            <Alert>
              <AlertDescription>
                All subscriptions have potential matches. Great!
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <Alert className="border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertTitle className="text-red-900">
                  Manual Review Required
                </AlertTitle>
                <AlertDescription className="text-red-700">
                  These subscriptions have no obvious matches in the database.
                  Use the search function to manually find and link the correct
                  student.
                </AlertDescription>
              </Alert>
              {noMatchesWithMatches.map(({ sub, matches }) => (
                <SubscriptionCard
                  key={sub.id}
                  subscription={sub}
                  potentialMatches={matches}
                />
              ))}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
