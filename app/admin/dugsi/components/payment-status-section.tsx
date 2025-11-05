'use client'

import { useState, useTransition } from 'react'

import { useRouter } from 'next/navigation'

import {
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  ExternalLink,
  Loader2,
  RefreshCw,
  XCircle,
  Calendar,
  AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  STRIPE_ID_DISPLAY_LENGTH,
  getStripeCustomerUrl,
} from '@/lib/constants/dugsi'
import { formatDate } from '@/lib/utils/formatters'
import { formatPeriodRange } from '@/lib/utils/subscription-status'
import {
  isPaymentStatusData,
  type PaymentStatusData,
} from '@/lib/utils/type-guards'

import { getDugsiPaymentStatus } from '../actions'
import { LinkSubscriptionDialog } from './dialogs/link-subscription-dialog'

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
    currentPeriodStart: Date | string | null
    currentPeriodEnd: Date | string | null
  }>
}

export function PaymentStatusSection({
  familyMembers,
}: PaymentStatusSectionProps) {
  const router = useRouter()
  const [isRefreshing, startTransition] = useTransition()
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const [_paymentStatus, setPaymentStatus] = useState<PaymentStatusData | null>(
    null
  )

  const parentEmail = familyMembers[0]?.parentEmail

  const hasPaymentMethod = familyMembers.some((m) => m.paymentMethodCaptured)
  const hasSubscription = familyMembers.some((m) => m.stripeSubscriptionIdDugsi)

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
        // Use type guard for runtime validation
        if (isPaymentStatusData(result.data)) {
          setPaymentStatus(result.data)
          toast.success('Payment status refreshed')
          // Use Next.js router for better UX
          router.refresh()
        } else {
          toast.error('Invalid payment status data received')
        }
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
    // Using helper function for URL generation
    window.open(getStripeCustomerUrl(customerId), '_blank')
  }

  return (
    <>
      <TooltipProvider>
        <Card className="overflow-hidden border-[#007078]/20">
          <CardHeader className="bg-gradient-to-r from-[#007078]/5 to-[#007078]/10 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#007078]/10">
                  <CreditCard className="h-4 w-4 text-[#007078]" />
                </div>
                <CardTitle className="text-lg font-semibold">
                  Payment & Subscription
                </CardTitle>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleRefreshStatus}
                    disabled={isRefreshing}
                    className="h-8 w-8 p-0"
                  >
                    {isRefreshing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh payment status</TooltipContent>
              </Tooltip>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 p-4">
            {/* Status Grid - Compact 3-column layout */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {/* Payment Method Status */}
              <div className="rounded-lg border bg-background p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Payment Method
                  </span>
                  {hasPaymentMethod ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {hasPaymentMethod ? (
                    <Badge className="border-green-200 bg-green-100 text-green-800">
                      Captured
                    </Badge>
                  ) : (
                    <Badge
                      variant="destructive"
                      className="border-red-200 bg-red-100 text-red-800"
                    >
                      Not Captured
                    </Badge>
                  )}
                </div>
                {hasPaymentMethod &&
                  familyMembers[0]?.paymentMethodCapturedAt && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(familyMembers[0].paymentMethodCapturedAt)}
                    </p>
                  )}
              </div>

              {/* Subscription Status */}
              <div className="rounded-lg border bg-background p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Subscription
                  </span>
                  {activeSubscription?.subscriptionStatus === 'active' ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : hasSubscription ? (
                    <Clock className="h-4 w-4 text-yellow-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-gray-400" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {activeSubscription?.subscriptionStatus === 'active' ? (
                    <Badge className="border-green-200 bg-green-100 text-green-800">
                      Active
                    </Badge>
                  ) : hasSubscription ? (
                    <Badge
                      variant="outline"
                      className="border-yellow-600 text-yellow-700"
                    >
                      {activeSubscription?.subscriptionStatus || 'Inactive'}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">None</Badge>
                  )}
                </div>
                {!hasSubscription && hasPaymentMethod && (
                  <p className="mt-1 text-xs text-amber-600">Ready to link</p>
                )}
              </div>

              {/* Next Billing */}
              <div className="rounded-lg border bg-background p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Billing Period
                  </span>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex flex-col gap-1">
                  {activeSubscription?.currentPeriodStart &&
                  activeSubscription?.currentPeriodEnd ? (
                    <>
                      <span className="text-sm font-medium">
                        {formatPeriodRange(
                          activeSubscription.currentPeriodStart,
                          activeSubscription.currentPeriodEnd
                        )}
                      </span>
                      {activeSubscription.paidUntil && (
                        <p className="text-xs text-muted-foreground">
                          Ends {formatDate(activeSubscription.paidUntil)}
                        </p>
                      )}
                    </>
                  ) : activeSubscription?.paidUntil ? (
                    <span className="text-sm font-medium">
                      {formatDate(activeSubscription.paidUntil)}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </div>
                {activeSubscription?.subscriptionStatus === 'active' && (
                  <p className="mt-1 text-xs text-muted-foreground">Monthly</p>
                )}
              </div>
            </div>

            {/* Customer & Subscription Details */}
            {(familyMembers[0]?.stripeCustomerIdDugsi ||
              activeSubscription?.stripeSubscriptionIdDugsi) && (
              <div className="space-y-2 rounded-lg bg-muted/30 p-3">
                {familyMembers[0]?.stripeCustomerIdDugsi && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Customer:
                    </span>
                    <div className="flex items-center gap-1">
                      <code className="rounded bg-background px-2 py-0.5 text-xs">
                        {familyMembers[0].stripeCustomerIdDugsi.slice(
                          0,
                          STRIPE_ID_DISPLAY_LENGTH
                        )}
                        ...
                      </code>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() =>
                              handleCopyCustomerId(
                                familyMembers[0].stripeCustomerIdDugsi!
                              )
                            }
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Copy customer ID</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() =>
                              handleOpenInStripe(
                                familyMembers[0].stripeCustomerIdDugsi!
                              )
                            }
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>View in Stripe</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                )}

                {activeSubscription?.stripeSubscriptionIdDugsi && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Subscription:
                    </span>
                    <div className="flex items-center gap-2">
                      <code className="rounded bg-background px-2 py-0.5 text-xs">
                        {activeSubscription.stripeSubscriptionIdDugsi.slice(
                          0,
                          STRIPE_ID_DISPLAY_LENGTH
                        )}
                        ...
                      </code>
                      <Badge variant="outline" className="text-xs">
                        {familyMembers.length}{' '}
                        {familyMembers.length === 1 ? 'child' : 'children'}
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              {!hasSubscription && hasPaymentMethod && parentEmail && (
                <Button
                  size="sm"
                  onClick={() => setShowLinkDialog(true)}
                  className="flex-1 bg-[#007078] hover:bg-[#007078]/90"
                >
                  Link Subscription
                </Button>
              )}
              {!hasPaymentMethod && (
                <div className="flex-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
                  <AlertCircle className="mx-auto mb-1 h-4 w-4 text-amber-600" />
                  <p className="text-xs text-amber-800">
                    Awaiting $1 payment method capture
                  </p>
                </div>
              )}
              {familyMembers[0]?.stripeCustomerIdDugsi && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    window.open(
                      getStripeCustomerUrl(
                        familyMembers[0].stripeCustomerIdDugsi!
                      ),
                      '_blank'
                    )
                  }
                  className={
                    !hasSubscription && hasPaymentMethod ? '' : 'flex-1'
                  }
                >
                  <ExternalLink className="mr-2 h-3.5 w-3.5" />
                  Manage in Stripe
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </TooltipProvider>

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

// formatDate function moved to shared formatters utility
