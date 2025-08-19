import { useState } from 'react'

import { getSetupIntent } from '@/lib/actions/get-setup-intent'

import { FormStatus } from './types'

interface UseSetupIntentProps {
  onComplete: (setupIntentId: string) => Promise<void>
}

interface BankDetails {
  bankName?: string
  last4?: string
  routingNumber?: string
  accountType?: string
}

export function useSetupIntent({ onComplete }: UseSetupIntentProps) {
  const [status, setStatus] = useState<FormStatus>('initial')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null)

  /**
   * Handles various statuses of the SetupIntent during the setup process
   */
  const handleSetupIntentStatus = async (
    setupIntentStatus: string,
    setupIntentId: string
  ) => {
    setStatus(setupIntentStatus as FormStatus)

    try {
      const fullSetupIntent = await getSetupIntent(setupIntentId)

      // Handle different statuses
      switch (setupIntentStatus) {
        case 'requires_payment_method':
          setErrorMessage('Please try setting up your bank account again.')
          break
        case 'requires_confirmation':
          if (fullSetupIntent.paymentMethod) {
            setBankDetails({
              bankName: fullSetupIntent.paymentMethod.bankName,
              last4: fullSetupIntent.paymentMethod.last4,
              routingNumber: fullSetupIntent.paymentMethod.routingNumber,
              accountType: fullSetupIntent.paymentMethod.accountType,
            })
          }
          setProgress(60)
          break
        case 'requires_action':
          setProgress(75)
          break
        case 'processing':
          setProgress(90)
          break
        case 'succeeded':
          setProgress(100)
          await onComplete(setupIntentId)
          break
        case 'canceled':
          setErrorMessage('The bank account setup was canceled.')
          setProgress(0)
          break
        default:
          setErrorMessage('An unexpected error occurred. Please try again.')
          setProgress(0)
          break
      }
    } catch (error) {
      console.error('Error in handleSetupIntentStatus:', error)
      setErrorMessage(
        'Failed to retrieve setup intent details. Please try again.'
      )
    }
  }

  return {
    status,
    isLoading,
    errorMessage,
    progress,
    bankDetails,
    handleSetupIntentStatus,
    setIsLoading,
    setErrorMessage,
    setProgress,
    setBankDetails,
  }
}
