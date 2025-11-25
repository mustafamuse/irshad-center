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

import { useTransition } from 'react'

import { Mail, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { createClientLogger } from '@/lib/logger-client'

import { Family } from '../_types'
import { formatParentName } from '../_utils/format'
import { generatePaymentLink } from '../actions'
import { SwipeAction } from '../components/ui/swipeable-card'

const logger = createClientLogger('useFamilyActions')

interface UseFamilyActionsProps {
  onViewDetails: (family: Family) => void
}

export function useFamilyActions({ onViewDetails }: UseFamilyActionsProps) {
  const [isPending, startTransition] = useTransition()

  // Swipe actions for mobile
  const getSwipeActions = (family: Family): SwipeAction[] => {
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
  }

  // Dropdown action handlers
  const handleViewDetails = (family: Family) => {
    onViewDetails(family)
  }

  const handleLinkSubscription = (_family: Family) => {
    toast.info('Link subscription functionality coming soon')
    // TODO: Implement link subscription dialog
  }

  const handleSendPaymentLink = (family: Family) => {
    const firstMember = family.members[0]
    if (!firstMember) {
      toast.error('Family member not found')
      return
    }

    startTransition(async () => {
      try {
        // Pass family members to avoid redundant database query
        const result = await generatePaymentLink(firstMember.id, family.members)

        if (!result.success) {
          toast.error(result.error || 'Failed to generate payment link')
          return
        }

        if (!result.data) {
          toast.error('No payment link data returned')
          return
        }

        // Copy to clipboard
        try {
          await navigator.clipboard.writeText(result.data.paymentUrl)

          // Get parent phone number
          const parentPhone = family.parentPhone || firstMember.parentPhone

          // Show success toast with WhatsApp option
          if (parentPhone) {
            let phoneNumber = parentPhone.replace(/\D/g, '')

            // Add country code if missing (assume US +1 for 10-digit numbers)
            if (phoneNumber.length === 10 && !phoneNumber.startsWith('1')) {
              phoneNumber = `1${phoneNumber}`
            }

            if (phoneNumber) {
              const message = encodeURIComponent(
                `As-salāmu ʿalaykum wa raḥmatullāh.\n\nFrom Irshad Dugsi — please complete your registration by setting up autopay. It's only a $1 setup charge to activate, no full payment will be taken now in shāʾ Allāh.\n\n---\n\nAs-salāmu ʿalaykum wa raḥmatullāh.\n\nKa socota Irshad Dugsi — fadlan dhammaystir diiwaangelinta adigoo dejinaya autopay-ga. Waxaa jiri doona $1 kaliya oo lagu dejinayo nidaamka, lacagta buuxdana laguma soo dallaci doono hadda in shāʾ Allāh.\n\n${result.data.paymentUrl}`
              )
              const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`

              // Open WhatsApp directly
              try {
                const link = document.createElement('a')
                link.href = whatsappUrl
                link.target = '_blank'
                link.rel = 'noopener noreferrer'
                document.body.appendChild(link)
                link.click()
                setTimeout(() => {
                  document.body.removeChild(link)
                }, 100)

                toast.success('Payment link copied to clipboard!', {
                  description: 'Opening WhatsApp...',
                })
              } catch (error) {
                logger.error('Error opening WhatsApp', error)
                // Fallback to window.open
                window.open(whatsappUrl, '_blank', 'noopener,noreferrer')

                toast.success('Payment link copied to clipboard!', {
                  action: {
                    label: 'Open WhatsApp',
                    onClick: () => {
                      window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
                    },
                  },
                })
              }
            } else {
              toast.success('Payment link copied to clipboard!', {
                description: 'Invalid phone number format',
              })
            }
          } else {
            toast.success('Payment link copied to clipboard!', {
              description: 'Phone number not available for WhatsApp',
            })
          }
        } catch (clipboardError) {
          // If clipboard fails, still show the link
          toast.error('Failed to copy to clipboard', {
            description: 'Please copy the link manually',
            action: {
              label: 'Copy Link',
              onClick: () => {
                navigator.clipboard.writeText(result.data!.paymentUrl)
              },
            },
          })
        }
      } catch (error) {
        logger.error('Error sending payment link', error)
        toast.error('Failed to generate payment link')
      }
    })
  }

  const handleSendEmail = (_family: Family) => {
    toast.info('Send email functionality coming soon')
    // TODO: Implement send email functionality
  }

  const handleViewInStripe = (customerId: string) => {
    const stripeUrl = `https://dashboard.stripe.com/customers/${customerId}`
    window.open(stripeUrl, '_blank', 'noopener,noreferrer')
  }

  return {
    getSwipeActions,
    handleViewDetails,
    handleLinkSubscription,
    handleSendPaymentLink,
    handleSendEmail,
    handleViewInStripe,
    isPending, // Expose loading state for UI components
  }
}
