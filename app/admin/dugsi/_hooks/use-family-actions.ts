/**
 * Hook for managing family action handlers in the Dugsi admin
 *
 * Provides consistent action handlers for:
 * - Swipeable card actions (email, delete)
 * - Dropdown menu actions (view details, link subscription, send payment link, view in Stripe)
 *
 * This centralizes action logic and makes it easier to add new actions or modify existing ones.
 */

'use client'

import { useCallback } from 'react'

import { Mail, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Family } from '../_types'
import { formatParentName } from '../_utils/format'
import { SwipeAction } from '../components/ui/swipeable-card'

interface UseFamilyActionsProps {
  onViewDetails: (family: Family) => void
}

export function useFamilyActions({ onViewDetails }: UseFamilyActionsProps) {
  // Swipe actions for mobile
  const getSwipeActions = useCallback((family: Family): SwipeAction[] => {
    const firstMember = family.members[0]
    const parentName = formatParentName(
      firstMember?.parentFirstName,
      firstMember?.parentLastName
    )

    return [
      {
        icon: Mail,
        label: 'Email',
        color: 'blue',
        onAction: () => {
          toast.info(`Email action for ${parentName}`)
          // TODO: Implement email functionality
        },
      },
      {
        icon: Trash2,
        label: 'Delete',
        color: 'red',
        onAction: () => {
          toast.info(`Delete action for ${parentName}`)
          // TODO: Implement delete with confirmation
        },
      },
    ]
  }, [])

  // Dropdown action handlers
  const handleViewDetails = useCallback(
    (family: Family) => {
      onViewDetails(family)
    },
    [onViewDetails]
  )

  const handleLinkSubscription = useCallback((_family: Family) => {
    toast.info('Link subscription functionality coming soon')
    // TODO: Implement link subscription dialog
  }, [])

  const handleSendPaymentLink = useCallback((_family: Family) => {
    toast.info('Send payment link functionality coming soon')
    // TODO: Implement send payment link functionality
  }, [])

  const handleSendEmail = useCallback((_family: Family) => {
    toast.info('Send email functionality coming soon')
    // TODO: Implement send email functionality
  }, [])

  const handleViewInStripe = useCallback((customerId: string) => {
    const stripeUrl = `https://dashboard.stripe.com/customers/${customerId}`
    window.open(stripeUrl, '_blank', 'noopener,noreferrer')
  }, [])

  return {
    getSwipeActions,
    handleViewDetails,
    handleLinkSubscription,
    handleSendPaymentLink,
    handleSendEmail,
    handleViewInStripe,
  }
}
