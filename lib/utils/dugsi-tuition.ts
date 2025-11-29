/**
 * Dugsi Tuition Rate Calculation
 *
 * Calculates tuition rates for Dugsi families based on:
 * - Number of children enrolled
 * - Tiered discount structure for larger families
 * - Optional admin override
 *
 * Rate formula (tiered by child count):
 * - 1-2 children: $80/child
 * - 3rd child: $70
 * - 4th+ children: $60 each (minimum rate)
 *
 * Examples:
 * - 1 child: $80
 * - 2 children: $160 ($80 + $80)
 * - 3 children: $230 ($80 + $80 + $70)
 * - 4 children: $290 ($80 + $80 + $70 + $60)
 * - 5 children: $350 ($80 + $80 + $70 + $60 + $60)
 *
 * NOTE: Dugsi uses monthly billing only (no bi-monthly option)
 * NOTE: Admin can override the calculated rate when generating payment links
 */

/**
 * Rate constants in cents
 */
export const DUGSI_RATES = {
  BASE_RATE: 8000, // $80/child for 1st and 2nd children
  THIRD_CHILD: 7000, // $70 for 3rd child
  FOURTH_PLUS: 6000, // $60 for 4th+ children (minimum per child)
} as const

/**
 * Minimum rate per child (used for validation)
 */
export const MIN_RATE_PER_CHILD = DUGSI_RATES.FOURTH_PLUS

/**
 * Maximum expected rate for a family (sanity check)
 * Based on 10 children: $80*2 + $70 + $60*7 = $650
 */
export const MAX_EXPECTED_FAMILY_RATE = 65000

/**
 * Calculate Dugsi tuition rate based on number of children
 *
 * @param childCount - Number of children enrolled in Dugsi
 * @returns Rate in cents per month. Returns 0 for invalid input.
 *
 * @example
 * // 1 child: $80/month
 * calculateDugsiRate(1) // 8000
 *
 * @example
 * // 3 children: $230/month ($80 + $80 + $70)
 * calculateDugsiRate(3) // 23000
 *
 * @example
 * // 5 children: $350/month ($80 + $80 + $70 + $60 + $60)
 * calculateDugsiRate(5) // 35000
 */
export function calculateDugsiRate(childCount: number): number {
  if (childCount <= 0 || !Number.isInteger(childCount)) {
    return 0
  }

  if (childCount === 1) {
    return DUGSI_RATES.BASE_RATE
  }

  if (childCount === 2) {
    return DUGSI_RATES.BASE_RATE * 2
  }

  // 3+ children: $80 + $80 + $70 + ($60 * remaining)
  let total = DUGSI_RATES.BASE_RATE * 2 // First 2 at $80 each
  total += DUGSI_RATES.THIRD_CHILD // 3rd at $70

  if (childCount > 3) {
    total += DUGSI_RATES.FOURTH_PLUS * (childCount - 3) // 4th+ at $60 each
  }

  return total
}

/**
 * Get the rate breakdown for display purposes
 *
 * @param childCount - Number of children enrolled
 * @returns Breakdown of rate per tier
 *
 * @example
 * getRateBreakdown(4)
 * // Returns:
 * // {
 * //   firstTwo: 16000,    // $80 * 2
 * //   third: 7000,        // $70
 * //   fourthPlus: 6000,   // $60 * 1
 * //   total: 29000        // $290
 * // }
 */
export function getRateBreakdown(childCount: number): {
  firstTwo: number
  third: number
  fourthPlus: number
  total: number
} {
  if (childCount <= 0) {
    return { firstTwo: 0, third: 0, fourthPlus: 0, total: 0 }
  }

  const firstTwoCount = Math.min(childCount, 2)
  const hasThird = childCount >= 3
  const fourthPlusCount = Math.max(childCount - 3, 0)

  const firstTwo = DUGSI_RATES.BASE_RATE * firstTwoCount
  const third = hasThird ? DUGSI_RATES.THIRD_CHILD : 0
  const fourthPlus = DUGSI_RATES.FOURTH_PLUS * fourthPlusCount
  const total = firstTwo + third + fourthPlus

  return { firstTwo, third, fourthPlus, total }
}

/**
 * Validate that an override amount is reasonable
 *
 * @param overrideAmount - Amount in cents
 * @param childCount - Number of children (for context)
 * @returns { valid: boolean, reason?: string }
 */
export function validateOverrideAmount(
  overrideAmount: number,
  childCount: number
): { valid: boolean; reason?: string } {
  if (overrideAmount <= 0) {
    return { valid: false, reason: 'Override amount must be positive' }
  }

  if (!Number.isInteger(overrideAmount)) {
    return { valid: false, reason: 'Override amount must be a whole number' }
  }

  // Check max rate first (more severe warning)
  if (overrideAmount > MAX_EXPECTED_FAMILY_RATE) {
    return {
      valid: true,
      reason: `Override exceeds typical maximum rate of ${formatRate(MAX_EXPECTED_FAMILY_RATE)}`,
    }
  }

  // Warn if override is more than 50% different from calculated
  const calculatedRate = calculateDugsiRate(childCount)
  if (calculatedRate > 0) {
    const difference =
      Math.abs(overrideAmount - calculatedRate) / calculatedRate
    if (difference > 0.5) {
      return {
        valid: true,
        reason: `Override differs significantly from calculated rate (${formatRate(calculatedRate)})`,
      }
    }
  }

  return { valid: true }
}

/**
 * Format rate for display (converts cents to dollars)
 *
 * @param rateInCents - Rate in cents
 * @returns Formatted string like "$80.00"
 */
export function formatRate(rateInCents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(rateInCents / 100)
}

/**
 * Format rate with "/month" suffix for display
 *
 * @param rateInCents - Rate in cents
 * @returns Formatted string like "$80.00/month"
 */
export function formatRateDisplay(rateInCents: number): string {
  return `${formatRate(rateInCents)}/month`
}

/**
 * Get human-readable description of rate tier
 *
 * @param childCount - Number of children
 * @returns Description of the tier
 */
export function getRateTierDescription(childCount: number): string {
  if (childCount <= 0) return 'No children enrolled'
  if (childCount === 1) return '1 child at $80/month'
  if (childCount === 2) return '2 children at $80/month each'
  if (childCount === 3) return '3 children (2 at $80, 1 at $70)'

  const fourthPlusCount = childCount - 3
  return `${childCount} children (2 at $80, 1 at $70, ${fourthPlusCount} at $60)`
}

/**
 * Get the Stripe billing interval for Dugsi (always monthly)
 *
 * @returns Stripe interval configuration
 */
export function getStripeInterval(): {
  interval: 'month'
  interval_count: number
} {
  return {
    interval: 'month',
    interval_count: 1,
  }
}
