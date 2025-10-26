'use client'

import { useState, useTransition } from 'react'

import { format } from 'date-fns'
import {
  CheckCircle,
  Copy,
  CreditCard,
  ExternalLink,
  Loader2,
  RefreshCw,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

import { getDugsiPaymentStatus } from '../actions'
import { LinkSubscriptionDialog } from './link-subscription-dialog'

interface PaymentStatusSectionProps {
  familyMembers: Array<{
    id: string
    name: string
    parentEmail: string | null
    paymentMethodCaptured: boolean
    paymentMethodCapturedAt: Date | string | null
    stripeCustomerIdDugsi: string | null
    stripeSubscriptionIdDugsi: string | null
    subscriptionStatus: string | null
    paidUntil: Date | string | null
  }>
}

interface PaymentStatusData {
  familyEmail: string
  studentCount: number
  hasPaymentMethod: boolean
  hasSubscription: boolean
  stripeCustomerId?: string | null
  subscriptionId?: string | null
  subscriptionStatus?: string | null
  paidUntil?: Date | null
  students: Array<{ id: string; name: string }>
}

export function PaymentStatusSection({
  familyMembers,
}: PaymentStatusSectionProps) {
  const [isRefreshing, startTransition] = useTransition()
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const [_paymentStatus, setPaymentStatus] = useState<PaymentStatusData | null>(
    null
  )

  // Get the primary parent email (from first family member)
  const parentEmail = familyMembers[0]?.parentEmail

  // Check if any family member has payment method
  const hasPaymentMethod = familyMembers.some((m) => m.paymentMethodCaptured)
  const hasSubscription = familyMembers.some((m) => m.stripeSubscriptionIdDugsi)

  // Get subscription details from first member who has one
  const activeSubscription = familyMembers.find(
    (m) => m.stripeSubscriptionIdDugsi
  )

  const handleRefreshStatus = async () => {
    if (!parentEmail) {
      toast.error('No parent email found')
      return
    }

    startTransition(async () => {
      const result = await getDugsiPaymentStatus(parentEmail)
      if (result.success && result.data) {
        setPaymentStatus(result.data as PaymentStatusData)
        toast.success('Payment status refreshed')
        // You might want to refresh the parent component's data here
      } else {
        toast.error(result.error || 'Failed to refresh status')
      }
    })
  }

  const handleCopyCustomerId = (customerId: string) => {
    navigator.clipboard.writeText(customerId)
    toast.success('Customer ID copied to clipboard')
  }

  const handleOpenInStripe = (customerId: string) => {
    // Using live mode URL for Dugsi Stripe account
    const stripeUrl = `https://dashboard.stripe.com/customers/${customerId}`
    window.open(stripeUrl, '_blank')
  }

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="bg-muted/30">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="h-5 w-5" />
              Payment Information
            </CardTitle>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleRefreshStatus}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          {/* Payment Method Status */}
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Payment Method
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              {hasPaymentMethod ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-600">Captured</span>
                  {familyMembers[0]?.paymentMethodCapturedAt && (
                    <span className="text-sm text-muted-foreground">
                      on {formatDate(familyMembers[0].paymentMethodCapturedAt)}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-600" />
                  <span className="font-medium text-red-600">Not Captured</span>
                  <Badge variant="secondary" className="ml-2 text-xs">
                    Awaiting $1 payment
                  </Badge>
                </>
              )}
            </div>
          </div>

          {/* Stripe Customer ID */}
          {familyMembers[0]?.stripeCustomerIdDugsi && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Stripe Customer ID
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <code className="rounded bg-muted px-2 py-1 text-xs">
                  {familyMembers[0].stripeCustomerIdDugsi}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  onClick={() =>
                    handleCopyCustomerId(
                      familyMembers[0].stripeCustomerIdDugsi!
                    )
                  }
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  onClick={() =>
                    handleOpenInStripe(familyMembers[0].stripeCustomerIdDugsi!)
                  }
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          <Separator />

          {/* Subscription Status */}
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Subscription
            </p>
            {hasSubscription && activeSubscription ? (
              <div className="mt-2 space-y-3">
                <div className="flex items-center gap-2">
                  {activeSubscription.subscriptionStatus === 'active' ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <Badge className="bg-green-100 text-green-800">
                        Active
                      </Badge>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5 text-yellow-600" />
                      <Badge variant="outline">
                        {activeSubscription.subscriptionStatus || 'Inactive'}
                      </Badge>
                    </>
                  )}
                </div>

                <div className="space-y-1.5 rounded-lg bg-muted/50 p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ID:</span>
                    <code className="text-xs">
                      {activeSubscription.stripeSubscriptionIdDugsi}
                    </code>
                  </div>
                  {activeSubscription.paidUntil && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Paid Until:</span>
                      <span>{formatDate(activeSubscription.paidUntil)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Children:</span>
                    <span>{familyMembers.length}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-2">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-gray-400" />
                  <span className="text-gray-600">No Subscription</span>
                </div>
                {hasPaymentMethod && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Payment method ready. You can now create a subscription in
                    Stripe Dashboard or link an existing one.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            {!hasSubscription && hasPaymentMethod && parentEmail && (
              <Button
                size="sm"
                onClick={() => setShowLinkDialog(true)}
                className="flex-1"
              >
                Link Subscription
              </Button>
            )}
            {familyMembers[0]?.stripeCustomerIdDugsi && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  window.open(
                    `https://dashboard.stripe.com/customers/${familyMembers[0].stripeCustomerIdDugsi}`,
                    '_blank'
                  )
                }
                className="flex-1"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                View in Stripe
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Link Subscription Dialog */}
      {parentEmail && (
        <LinkSubscriptionDialog
          open={showLinkDialog}
          onOpenChange={setShowLinkDialog}
          parentEmail={parentEmail}
          familyMembers={familyMembers}
        />
      )}
    </>
  )
}

function formatDate(value: Date | string | null) {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  return format(date, 'MMM d, yyyy')
}
