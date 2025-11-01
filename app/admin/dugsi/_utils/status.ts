/**
 * Status badge utilities
 * Centralized status badge configuration logic
 */

import { CheckCircle2, AlertCircle, XCircle } from 'lucide-react'

import { FamilyStatus } from '../_types'

/**
 * Get status badge configuration
 */
export function getStatusBadgeConfig(status: FamilyStatus) {
  switch (status) {
    case 'active':
      return {
        label: 'Active',
        icon: CheckCircle2,
        className: 'bg-green-100 text-green-800 hover:bg-green-100',
      }
    case 'pending':
      return {
        label: 'Pending Setup',
        icon: AlertCircle,
        className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
      }
    case 'no-payment':
      return {
        label: 'No Payment',
        icon: XCircle,
        className: 'bg-gray-100 text-gray-800 hover:bg-gray-100',
      }
  }
}
