import { toZonedTime } from 'date-fns-tz'

import {
  BILLING_TIMEZONE,
  formatBillingDate,
  getNextBillingDate,
  parseBillingDay,
} from '@/lib/utils/billing-date'

interface BillingPreviewProps {
  billingStartDay: string
}

/**
 * Displays billing start date preview with context-aware warnings.
 * Shows when billing will start based on selected day of month.
 * Warns user if selected day has passed this month (billing starts next month).
 */
export function BillingPreview({ billingStartDay }: BillingPreviewProps) {
  const day = parseBillingDay(billingStartDay)
  if (!day) return null

  const billingDate = getNextBillingDate(day)
  const nowInTz = toZonedTime(new Date(), BILLING_TIMEZONE)
  const currentDay = nowInTz.getDate()
  const isNextMonth = day <= currentDay

  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">
        Billing will start:{' '}
        <span className="font-medium text-foreground">
          {formatBillingDate(billingDate)}
        </span>
      </p>
      {isNextMonth && (
        <p className="text-xs text-amber-600">
          The{' '}
          {day === currentDay
            ? 'selected day is today'
            : `${day}${day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'} has passed`}
          , so billing starts next month.
        </p>
      )}
    </div>
  )
}
