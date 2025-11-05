import {
  AlertCircle,
  CheckCircle,
  Circle,
  Clock,
  XCircle,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'

/**
 * Get a status badge component for subscription/payment status.
 * Used across Payment Management and Students Table for consistency.
 *
 * @param status - The subscription status from Stripe
 * @param hasSubscription - Whether the student has a subscription ID
 * @returns A Badge component with appropriate styling and icon
 */
export function getPaymentStatusBadge(
  status: string | null,
  hasSubscription: boolean = true
) {
  if (!hasSubscription || !status) {
    return (
      <Badge variant="secondary" className="gap-1">
        <Circle className="h-2 w-2" />
        No Subscription
      </Badge>
    )
  }

  switch (status) {
    case 'active':
      return (
        <Badge variant="default" className="gap-1 bg-green-600">
          <CheckCircle className="h-3 w-3" />
          Active
        </Badge>
      )
    case 'incomplete':
      return (
        <Badge
          variant="secondary"
          className="gap-1 border-yellow-600 text-yellow-600"
        >
          <AlertCircle className="h-3 w-3" />
          Incomplete
        </Badge>
      )
    case 'past_due':
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="h-3 w-3" />
          Past Due
        </Badge>
      )
    case 'trialing':
      return (
        <Badge variant="outline" className="gap-1">
          <Clock className="h-3 w-3" />
          Trialing
        </Badge>
      )
    case 'canceled':
      return (
        <Badge variant="outline" className="gap-1 text-muted-foreground">
          <XCircle className="h-3 w-3" />
          Canceled
        </Badge>
      )
    case 'unpaid':
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          Unpaid
        </Badge>
      )
    case 'incomplete_expired':
      return (
        <Badge variant="secondary" className="gap-1 text-muted-foreground">
          <XCircle className="h-3 w-3" />
          Expired
        </Badge>
      )
    default:
      return (
        <Badge variant="secondary" className="gap-1">
          {status}
        </Badge>
      )
  }
}

/**
 * Check if a student needs bank account verification.
 *
 * @param student - Student data with payment fields
 * @returns true if the student needs bank verification
 */
export function needsBankVerification(student: {
  paymentIntentIdMahad?: string | null
  subscriptionStatus?: string | null
  stripeSubscriptionId?: string | null
}): boolean {
  return Boolean(
    student.paymentIntentIdMahad &&
      student.subscriptionStatus !== 'active' &&
      student.stripeSubscriptionId
  )
}
