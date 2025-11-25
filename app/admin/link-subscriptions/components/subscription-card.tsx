'use client'

import { useState } from 'react'

import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { formatPeriodRange } from '@/lib/utils/subscription-status'

import type { OrphanedSubscription, StudentMatch } from '../actions'
import { linkSubscriptionToStudent } from '../actions'
import { StudentSelector } from './student-selector'

interface SubscriptionCardProps {
  subscription: OrphanedSubscription
  potentialMatches?: StudentMatch[]
}

export function SubscriptionCard({
  subscription,
  potentialMatches = [],
}: SubscriptionCardProps) {
  const [selectedStudent, setSelectedStudent] = useState<StudentMatch | null>(
    potentialMatches.length === 1 ? potentialMatches[0] : null
  )
  const [isLinking, setIsLinking] = useState(false)

  const handleLink = async () => {
    if (!selectedStudent) {
      toast.error('Please select a student')
      return
    }

    setIsLinking(true)
    try {
      const result = await linkSubscriptionToStudent(
        subscription.id,
        selectedStudent.id,
        subscription.program
      )

      if (result.success) {
        toast.success(
          `Successfully linked subscription to ${selectedStudent.name}`
        )
        // Reset selection
        setSelectedStudent(null)
      } else {
        toast.error(result.error || 'Failed to link subscription')
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setIsLinking(false)
    }
  }

  const getStatusBadgeVariant = () => {
    if (subscription.status === 'active') return 'default'
    if (subscription.status === 'trialing') return 'secondary'
    if (subscription.status === 'past_due') return 'destructive'
    return 'outline'
  }

  const getCardBorderClass = () => {
    if (subscription.subscriptionCount > 1)
      return 'border-l-4 border-l-yellow-500'
    if (!subscription.customerEmail) return 'border-l-4 border-l-red-500'
    if (potentialMatches.length > 0) return 'border-l-4 border-l-green-500'
    return ''
  }

  return (
    <Card className={getCardBorderClass()}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              {subscription.customerName || 'No Name'}
              <Badge variant={getStatusBadgeVariant()}>
                {subscription.status}
              </Badge>
              {subscription.subscriptionCount > 1 && (
                <Badge
                  variant="outline"
                  className="border-yellow-200 bg-yellow-50 text-yellow-700"
                >
                  {subscription.subscriptionCount} subscriptions
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {subscription.customerEmail || 'No email provided'}
            </CardDescription>
          </div>
          <Badge variant="secondary">{subscription.program}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Amount</p>
            <p className="font-medium">
              ${(subscription.amount / 100).toFixed(2)}/month
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Customer ID</p>
            <p className="font-mono text-xs">
              {subscription.customerId.slice(-12)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Created</p>
            <p className="font-medium">
              {subscription.created.toLocaleDateString()}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Billing Period</p>
            <p className="font-medium">
              {subscription.currentPeriodStart && subscription.currentPeriodEnd
                ? formatPeriodRange(
                    subscription.currentPeriodStart,
                    subscription.currentPeriodEnd
                  )
                : subscription.currentPeriodEnd
                  ? subscription.currentPeriodEnd.toLocaleDateString()
                  : 'N/A'}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Subscription ID</p>
          <code className="block rounded bg-muted px-2 py-1 text-xs">
            {subscription.id}
          </code>
        </div>

        {potentialMatches.length > 0 && (
          <div className="rounded-md border border-green-200 bg-green-50 p-3">
            <p className="text-sm font-medium text-green-900">
              {potentialMatches.length} potential{' '}
              {potentialMatches.length === 1 ? 'match' : 'matches'} found
            </p>
            <p className="mt-1 text-xs text-green-700">
              Email matches student(s) in database
            </p>
          </div>
        )}

        {subscription.subscriptionCount > 1 && (
          <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3">
            <p className="text-sm font-medium text-yellow-900">
              Multiple Subscriptions
            </p>
            <p className="mt-1 text-xs text-yellow-700">
              This customer has {subscription.subscriptionCount} subscriptions.
              They may be paying for multiple students.
            </p>
          </div>
        )}

        {!subscription.customerEmail && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3">
            <p className="text-sm font-medium text-red-900">No Email on File</p>
            <p className="mt-1 text-xs text-red-700">
              This subscription has no customer email. Search manually to find
              the student.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium">Select Student</label>
          <StudentSelector
            program={subscription.program}
            customerEmail={subscription.customerEmail}
            potentialMatches={potentialMatches}
            value={selectedStudent}
            onChange={setSelectedStudent}
          />
        </div>
      </CardContent>

      <CardFooter className="flex gap-2">
        <Button
          onClick={handleLink}
          disabled={!selectedStudent || isLinking}
          className="flex-1"
        >
          {isLinking ? 'Linking...' : 'Link Subscription'}
        </Button>
        {selectedStudent && (
          <Button
            variant="outline"
            onClick={() => setSelectedStudent(null)}
            disabled={isLinking}
          >
            Clear
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
