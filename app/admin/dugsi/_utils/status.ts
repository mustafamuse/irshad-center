/**
 * Status badge utilities
 * Centralized status badge configuration logic
 */

import {
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Pause,
  UserX,
} from 'lucide-react'

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
    case 'paused':
      return {
        label: 'Paused',
        icon: Pause,
        className: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
      }
    case 'inactive':
      return {
        label: 'Inactive',
        icon: UserX,
        className: 'bg-slate-100 text-slate-600 hover:bg-slate-100',
      }
    case 'churned':
      return {
        label: 'Churned',
        icon: RotateCcw,
        className: 'bg-gray-100 text-gray-600 hover:bg-gray-100',
      }
    case 'no-payment':
      return {
        label: 'No Payment',
        icon: AlertCircle,
        className: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
      }
  }
}
