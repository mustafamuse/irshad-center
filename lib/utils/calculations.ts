export function getBillingCycleAnchor(dayOfMonth: number = 1): number {
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  // Create date for next billing cycle
  const billingDate = new Date(currentYear, currentMonth + 1, dayOfMonth)

  // If the billing date would be in the past, move to next month
  if (billingDate.getTime() <= now.getTime()) {
    billingDate.setMonth(billingDate.getMonth() + 1)
  }

  return Math.floor(billingDate.getTime() / 1000) // Convert to Unix timestamp
}
