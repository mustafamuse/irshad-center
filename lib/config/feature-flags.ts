/**
 * Centralized Feature Flags
 *
 * All feature flags in one place for easy auditing and management.
 * Toggle these via environment variables in Vercel without redeploying.
 *
 * Usage:
 *   import { featureFlags } from '@/lib/config/feature-flags'
 *   if (featureFlags.dugsiCardPayments()) { ... }
 *
 * Vercel Configuration:
 *   - Go to Project Settings > Environment Variables
 *   - Add the flag with value 'true' to enable
 *   - Remove or set to any other value to disable
 *   - Changes take effect immediately (no redeploy needed)
 */

export const featureFlags = {
  /**
   * Enable card payments for Dugsi program
   * When enabled: Families can pay with card or ACH
   * When disabled: ACH only (lower transaction fees)
   */
  dugsiCardPayments: (): boolean =>
    process.env.DUGSI_CARD_PAYMENTS_ENABLED === 'true',

  /**
   * Enable card payments for Mahad program
   * When enabled: Students can pay with card or ACH
   * When disabled: ACH only (lower transaction fees)
   */
  mahadCardPayments: (): boolean =>
    process.env.MAHAD_CARD_PAYMENTS_ENABLED === 'true',
} as const

/**
 * Get all feature flag states for debugging/logging
 */
export function getFeatureFlagStates(): Record<string, boolean> {
  return {
    dugsiCardPayments: featureFlags.dugsiCardPayments(),
    mahadCardPayments: featureFlags.mahadCardPayments(),
  }
}
