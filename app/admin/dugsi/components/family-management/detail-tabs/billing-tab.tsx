'use client'

import { useEffect, useState } from 'react'

import {
  CreditCard,
  DollarSign,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import { Family, StripePaymentHistoryItem } from '../../../_types'
import { getBillingStatus } from '../../../_utils/billing'
import { getFamilyPaymentHistory } from '../../../actions'

interface BillingTabProps {
  family: Family
}

export function BillingTab({ family }: BillingTabProps) {
  const [paymentHistory, setPaymentHistory] = useState<
    StripePaymentHistoryItem[]
  >([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const firstMember = family.members[0]
  const customerId = firstMember?.stripeCustomerIdDugsi

  useEffect(() => {
    async function fetchHistory() {
      if (!customerId) return

      setIsLoading(true)
      setError(null)

      try {
        const result = await getFamilyPaymentHistory(customerId)

        if (result.success && result.data) {
          setPaymentHistory(result.data)
        } else {
          setError(result.error ?? 'Failed to fetch payment history')
        }
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : 'Failed to fetch payment history'
        )
      } finally {
        setIsLoading(false)
      }
    }

    fetchHistory()
  }, [customerId])

  const billing = firstMember ? getBillingStatus(firstMember) : null

  const handleViewInStripe = () => {
    if (customerId) {
      const stripeUrl = `https://dashboard.stripe.com/customers/${customerId}`
      window.open(stripeUrl, '_blank', 'noopener,noreferrer')
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount / 100)
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(date))
  }

  const getStatusIcon = (status: StripePaymentHistoryItem['status']) => {
    switch (status) {
      case 'succeeded':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'pending':
        return <Clock className="h-4 w-4 text-amber-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
    }
  }

  const getStatusBadge = (status: StripePaymentHistoryItem['status']) => {
    switch (status) {
      case 'succeeded':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700">
            Paid
          </Badge>
        )
      case 'pending':
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700">
            Pending
          </Badge>
        )
      case 'failed':
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700">
            Failed
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-5">
      {/* Subscription Status */}
      <div className="space-y-4 rounded-lg border bg-card p-5">
        <h3 className="text-base font-semibold">Subscription</h3>

        {family.hasSubscription ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Status</span>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  firstMember?.subscriptionStatus === 'active'
                    ? 'bg-green-50 text-green-700'
                    : 'bg-amber-50 text-amber-700'
                )}
              >
                {firstMember?.subscriptionStatus || 'Unknown'}
              </Badge>
            </div>

            {billing && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Expected Amount</span>
                    </div>
                    <span className="font-medium">
                      {formatCurrency(billing.expected)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="ml-6 text-sm">Actual Amount</span>
                    <span
                      className={cn(
                        'font-medium',
                        billing.status === 'underpaying' && 'text-red-600',
                        billing.status === 'overpaying' && 'text-green-600'
                      )}
                    >
                      {billing.actual !== null
                        ? formatCurrency(billing.actual)
                        : '-'}
                    </span>
                  </div>
                  {billing.status !== 'match' &&
                    billing.status !== 'no-subscription' && (
                      <div className="flex items-center justify-between">
                        <span className="ml-6 text-sm">Variance</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            billing.status === 'underpaying'
                              ? 'bg-red-50 text-red-700'
                              : 'bg-green-50 text-green-700'
                          )}
                        >
                          {billing.difference !== null
                            ? `${billing.difference > 0 ? '+' : ''}${formatCurrency(billing.difference)}`
                            : '-'}
                        </Badge>
                      </div>
                    )}
                </div>
              </>
            )}

            {customerId && (
              <>
                <Separator />
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={handleViewInStripe}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View in Stripe
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <CreditCard className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">No Active Subscription</p>
              <p className="text-sm text-muted-foreground">
                This family doesn&apos;t have an active subscription
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Payment History */}
      <div className="space-y-4 rounded-lg border bg-card p-5">
        <h3 className="text-base font-semibold">Payment History</h3>

        {!customerId ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <AlertCircle className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">No Stripe Customer</p>
              <p className="text-sm text-muted-foreground">
                Payment history not available
              </p>
            </div>
          </div>
        ) : isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-6 w-14 rounded-full" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
              <AlertCircle className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <p className="font-medium text-red-600">Error Loading History</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
        ) : paymentHistory.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <DollarSign className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">No Payments Yet</p>
              <p className="text-sm text-muted-foreground">
                Payment history will appear here
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {paymentHistory.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(payment.status)}
                  <div>
                    <p className="text-sm font-medium">
                      {formatCurrency(payment.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(payment.date)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(payment.status)}
                  {payment.invoiceUrl && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() =>
                        window.open(
                          payment.invoiceUrl!,
                          '_blank',
                          'noopener,noreferrer'
                        )
                      }
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
