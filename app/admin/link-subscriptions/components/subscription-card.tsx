'use client'

import { useState } from 'react'

import { ChevronDown, ChevronUp, Link2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
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
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)

  const handleLinkClick = () => {
    if (!selectedStudent) {
      toast.error('Please select a student')
      return
    }
    setShowConfirmDialog(true)
  }

  const handleLinkConfirm = async () => {
    if (!selectedStudent) return

    setIsLinking(true)
    setShowConfirmDialog(false)

    try {
      const result = await linkSubscriptionToStudent(
        subscription.id,
        selectedStudent.id,
        subscription.program
      )

      if (result.success) {
        toast.success(
          `Successfully linked subscription to ${selectedStudent.name}`,
          {
            action: {
              label: 'Undo',
              onClick: () => {
                toast.info('Undo functionality coming soon')
              },
            },
          }
        )
        setSelectedStudent(null)
      } else {
        toast.error(result.error || 'Failed to link subscription', {
          action: {
            label: 'Retry',
            onClick: () => {
              setShowConfirmDialog(true)
            },
          },
        })
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'An error occurred'
      toast.error(message, {
        action: {
          label: 'Retry',
          onClick: () => {
            setShowConfirmDialog(true)
          },
        },
      })
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
    <>
      <Card className={getCardBorderClass()}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-1.5">
              <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                <span className="truncate">
                  {subscription.customerName || 'No Name'}
                </span>
                <Badge
                  variant={getStatusBadgeVariant()}
                  className="shrink-0 capitalize"
                >
                  {subscription.status.replace('_', ' ')}
                </Badge>
                {subscription.subscriptionCount > 1 && (
                  <Badge
                    variant="outline"
                    className="shrink-0 border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-300"
                  >
                    {subscription.subscriptionCount} subscriptions
                  </Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                <CardDescription className="truncate">
                  {subscription.customerEmail || 'No email provided'}
                </CardDescription>
                <Badge variant="secondary" className="shrink-0 text-xs">
                  {subscription.program}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm sm:gap-4">
                <span className="font-semibold text-foreground">
                  ${(subscription.amount / 100).toFixed(2)}/month
                </span>
                <span className="text-muted-foreground">
                  Created {subscription.created.toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {potentialMatches.length > 0 && (
            <div className="rounded-md border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950">
              <p className="text-sm font-medium text-green-900 dark:text-green-100">
                {potentialMatches.length} potential{' '}
                {potentialMatches.length === 1 ? 'match' : 'matches'} found
              </p>
              <p className="mt-1 text-xs text-green-700 dark:text-green-300">
                Email matches student(s) in database
              </p>
            </div>
          )}

          {subscription.subscriptionCount > 1 && (
            <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-950">
              <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                Multiple Subscriptions
              </p>
              <p className="mt-1 text-xs text-yellow-700 dark:text-yellow-300">
                This customer has {subscription.subscriptionCount}{' '}
                subscriptions. They may be paying for multiple students.
              </p>
            </div>
          )}

          {!subscription.customerEmail && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950">
              <p className="text-sm font-medium text-red-900 dark:text-red-100">
                No Email on File
              </p>
              <p className="mt-1 text-xs text-red-700 dark:text-red-300">
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

          <Collapsible open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between text-xs"
              >
                <span>View Details</span>
                {isDetailsOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-muted-foreground">Customer ID</p>
                  <p className="font-mono text-xs">
                    {subscription.customerId.slice(-12)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Billing Period</p>
                  <p className="font-medium">
                    {subscription.currentPeriodStart &&
                    subscription.currentPeriodEnd
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
                <code className="block rounded bg-muted px-2 py-1.5 text-xs">
                  {subscription.id}
                </code>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>

        <CardFooter className="flex gap-2 pt-4">
          <Button
            onClick={handleLinkClick}
            disabled={!selectedStudent || isLinking}
            className="flex-1"
          >
            <Link2 className="mr-2 h-4 w-4" />
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

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Link Subscription</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to link this subscription to{' '}
              <strong>{selectedStudent?.name}</strong>?
              <br />
              <br />
              <span className="text-xs text-muted-foreground">
                Subscription: {subscription.id.slice(-12)}
                <br />
                Amount: ${(subscription.amount / 100).toFixed(2)}/month
                <br />
                Program: {subscription.program}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLinking}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLinkConfirm} disabled={isLinking}>
              {isLinking ? 'Linking...' : 'Confirm Link'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
