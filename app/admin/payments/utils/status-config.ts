/**
 * Status Configuration Utilities
 *
 * Shared status badge configuration for student and subscription statuses.
 * Extracted from students-data-table.tsx and students-mobile-cards.tsx
 * to eliminate code duplication.
 */

import {
  User,
  AlertCircle,
  CheckCircle,
  UserX,
  Clock,
  Zap,
  LucideIcon,
} from 'lucide-react'

// ============================================================================
// TYPES
// ============================================================================

type BadgeVariant = 'default' | 'destructive' | 'secondary' | 'outline'

export interface StatusConfig {
  variant: BadgeVariant
  className: string
  icon: LucideIcon
}

// ============================================================================
// STATUS CONFIGURATIONS
// ============================================================================

/**
 * Get badge configuration for student enrollment status.
 *
 * @param status - The enrollment status string
 * @returns Configuration object with variant, className, and icon
 */
export function getStatusConfig(status: string): StatusConfig {
  switch (status) {
    case 'enrolled':
      return {
        variant: 'default',
        className:
          'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-300 dark:border-green-800',
        icon: CheckCircle,
      }
    case 'past_due':
      return {
        variant: 'destructive',
        className:
          'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-300 dark:border-red-800',
        icon: AlertCircle,
      }
    case 'registered':
      return {
        variant: 'secondary',
        className:
          'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-800',
        icon: Clock,
      }
    case 'inactive':
      return {
        variant: 'outline',
        className: 'bg-muted text-muted-foreground border-border',
        icon: UserX,
      }
    case 'withdrawn':
      return {
        variant: 'outline',
        className:
          'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900 dark:text-orange-300 dark:border-orange-800',
        icon: UserX,
      }
    default:
      return {
        variant: 'outline',
        className: 'bg-muted text-muted-foreground border-border',
        icon: User,
      }
  }
}

/**
 * Get badge configuration for subscription status.
 *
 * @param status - The subscription status string or null
 * @returns Configuration object with variant, className, and icon
 */
export function getSubscriptionConfig(status: string | null): StatusConfig {
  switch (status) {
    case 'active':
      return {
        variant: 'default',
        className:
          'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-300 dark:border-green-800',
        icon: Zap,
      }
    case 'past_due':
      return {
        variant: 'destructive',
        className:
          'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-300 dark:border-red-800',
        icon: AlertCircle,
      }
    case 'canceled':
      return {
        variant: 'secondary',
        className:
          'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900 dark:text-orange-300 dark:border-orange-800',
        icon: UserX,
      }
    default:
      return {
        variant: 'secondary',
        className: 'bg-muted text-muted-foreground border-border',
        icon: AlertCircle,
      }
  }
}
