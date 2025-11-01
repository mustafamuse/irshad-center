/**
 * Status badge utilities and components
 * Centralized status badge rendering logic
 */

import { FamilyStatus } from '../_types'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, AlertCircle, XCircle } from 'lucide-react'

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

/**
 * Render status badge component
 */
export function FamilyStatusBadge({ status }: { status: FamilyStatus }) {
  const config = getStatusBadgeConfig(status)
  const Icon = config.icon

  return (
    <Badge className={config.className}>
      <Icon className="mr-1 h-3 w-3" />
      {config.label}
    </Badge>
  )
}
