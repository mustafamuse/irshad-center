import {
  formatBillingDate,
  getNextBillingDate,
  parseBillingDay,
} from '@/lib/utils/billing-date'

interface BillingPreviewProps {
  billingStartDay: string
}

export function BillingPreview({ billingStartDay }: BillingPreviewProps) {
  const day = parseBillingDay(billingStartDay)
  if (!day) return null

  return (
    <p className="text-sm text-muted-foreground">
      Billing will start:{' '}
      <span className="font-medium text-foreground">
        {formatBillingDate(getNextBillingDate(day))}
      </span>
    </p>
  )
}
