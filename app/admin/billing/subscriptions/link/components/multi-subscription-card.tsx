'use client'

import { useState } from 'react'

import { ChevronDown, ChevronUp, User } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

import type { OrphanedSubscription, StudentMatch } from '../actions'
import { SubscriptionCard } from './subscription-card'

interface MultiSubscriptionCardProps {
  customerId: string
  customerEmail: string
  customerName: string
  subscriptions: OrphanedSubscription[]
  potentialMatchesMap: Map<string, StudentMatch[]>
}

export function MultiSubscriptionCard({
  customerId,
  customerEmail,
  customerName,
  subscriptions,
  potentialMatchesMap,
}: MultiSubscriptionCardProps) {
  const [isOpen, setIsOpen] = useState(true)

  const totalAmount = subscriptions.reduce((sum, sub) => sum + sub.amount, 0)

  return (
    <Card className="border-l-4 border-l-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/20">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex flex-1 items-start gap-3">
              <div className="rounded-full bg-yellow-100 p-2 dark:bg-yellow-900/50">
                <User className="h-5 w-5 text-yellow-700 dark:text-yellow-300" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="flex flex-wrap items-center gap-2">
                  {customerName || 'No Name'}
                  <Badge
                    variant="outline"
                    className="border-yellow-300 bg-yellow-100 text-yellow-800"
                  >
                    {subscriptions.length} subscriptions
                  </Badge>
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {customerEmail}
                </p>
                <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                  <span>Customer ID: {customerId.slice(-12)}</span>
                  <span>Total: ${(totalAmount / 100).toFixed(2)}/month</span>
                </div>
              </div>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="shrink-0">
                {isOpen ? (
                  <>
                    <ChevronUp className="mr-1 h-4 w-4" />
                    <span className="hidden sm:inline">Collapse</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="mr-1 h-4 w-4" />
                    <span className="hidden sm:inline">Expand</span>
                  </>
                )}
              </Button>
            </CollapsibleTrigger>
          </div>

          <div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-100/50 p-3 dark:border-yellow-800 dark:bg-yellow-900/20">
            <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
              Multiple Subscriptions Detected
            </p>
            <p className="mt-1 text-xs text-yellow-800 dark:text-yellow-200">
              This customer is paying for {subscriptions.length} subscriptions.
              Link each subscription below to the correct student.
            </p>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {subscriptions.map((subscription, index) => (
              <div key={subscription.id} className="relative">
                <div className="absolute -left-4 top-4 rounded-r-md bg-yellow-500 px-2 py-1 text-xs font-bold text-white">
                  {index + 1} of {subscriptions.length}
                </div>
                <SubscriptionCard
                  subscription={subscription}
                  potentialMatches={
                    potentialMatchesMap.get(subscription.id) || []
                  }
                />
              </div>
            ))}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
