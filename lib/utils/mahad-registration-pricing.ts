import { BASE_RATES } from '@/lib/utils/mahad-tuition'

export type MahadGraduationStatus = keyof typeof BASE_RATES
export type MahadPaymentFrequency =
  keyof (typeof BASE_RATES)[MahadGraduationStatus]

const DOLLAR_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

function centsToDollars(cents: number): string {
  return DOLLAR_FORMATTER.format(cents / 100)
}

/**
 * Format a Mahad registration option's price for display in select items.
 *
 * Amounts in {@link BASE_RATES} are stored in cents (Stripe convention).
 * Returns a human-readable string such as `"$120/mo"` or
 * `"$220 (save $10/mo)"` for bi-monthly options.
 */
export function formatMahadOptionPrice(
  gradStatus: MahadGraduationStatus,
  freq: MahadPaymentFrequency
): string {
  const perMonthCents = BASE_RATES[gradStatus][freq]
  if (freq === 'BI_MONTHLY') {
    const monthlyCents = BASE_RATES[gradStatus].MONTHLY
    const savingsCents = monthlyCents - perMonthCents
    return `${centsToDollars(perMonthCents * 2)} (save ${centsToDollars(savingsCents)}/mo)`
  }
  return `${centsToDollars(perMonthCents)}/mo`
}

export interface MahadEstimate {
  label: string
  savingsLabel: string | null
}

/**
 * Returns the estimate labels shown in the registration form's pricing card.
 *
 * - Monthly:    `{ label: "Estimated: $120/month", savingsLabel: null }`
 * - Bi-monthly: `{ label: "Estimated: $220 every 2 months",
 *                   savingsLabel: "Save $10/month vs monthly billing" }`
 */
export function formatMahadEstimate(
  gradStatus: MahadGraduationStatus,
  freq: MahadPaymentFrequency
): MahadEstimate {
  const perMonthCents = BASE_RATES[gradStatus][freq]
  if (freq === 'BI_MONTHLY') {
    const monthlyCents = BASE_RATES[gradStatus].MONTHLY
    const savingsCents = monthlyCents - perMonthCents
    return {
      label: `Estimated: ${centsToDollars(perMonthCents * 2)} every 2 months`,
      savingsLabel:
        savingsCents > 0
          ? `Save ${centsToDollars(savingsCents)}/month vs monthly billing`
          : null,
    }
  }
  return {
    label: `Estimated: ${centsToDollars(perMonthCents)}/month`,
    savingsLabel: null,
  }
}
