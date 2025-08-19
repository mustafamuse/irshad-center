'use client'

import { useRouter } from 'next/navigation'

import { useStripe } from '@stripe/react-stripe-js'
import { motion, AnimatePresence } from 'framer-motion'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

import { ActionButton } from './action-button'
import { ProgressIndicator } from './progress-indicator'
import { StatusMessages } from './status-messages'
import { StripePaymentFormProps } from './types'
import { useSetupIntent } from './use-setup-intent'
import { showErrorToast, showStatusToast } from './utils'

export function StripePaymentForm({
  clientSecret,
  payorDetails,
  className,
  studentIds,
}: StripePaymentFormProps) {
  const stripe = useStripe()
  const router = useRouter()
  const completeEnrollmentFlow = async (setupIntentId: string) => {
    try {
      setIsLoading(true)
      setErrorMessage(null)
      setProgress(30)

      const response = await fetch('/api/enrollment/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ setupIntentId, studentIds }),
      })

      setProgress(60)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Failed to complete enrollment')
      }

      setProgress(100)
      showStatusToast('succeeded')

      // Wait for animation
      await new Promise((resolve) => setTimeout(resolve, 1000))
      router.push('/enrollment/success')
    } catch (err) {
      console.error('Error completing enrollment:', err)
      showErrorToast(err as Error)
      setProgress(0)
    } finally {
      setIsLoading(false)
    }
  }

  const {
    status,
    isLoading,
    errorMessage,
    progress,
    bankDetails,
    handleSetupIntentStatus,
    setIsLoading,
    setErrorMessage,
    setProgress,
  } = useSetupIntent({
    onComplete: completeEnrollmentFlow,
  })

  const setupBankAccount = async () => {
    if (!stripe) return

    setIsLoading(true)
    setErrorMessage(null)
    setProgress(30)

    try {
      const { setupIntent, error } = await stripe.collectBankAccountForSetup({
        clientSecret,
        params: {
          payment_method_type: 'us_bank_account',
          payment_method_data: {
            billing_details: {
              name: payorDetails.name,
              email: payorDetails.email,
              phone: payorDetails.phone,
            },
          },
        },
      })

      if (error) {
        console.error('Bank account collection error:', error)
        showErrorToast(
          new Error(error.message ?? 'Failed to setup bank account')
        )
        return
      }

      if (!setupIntent) {
        throw new Error('Failed to setup bank account')
      }

      // Pass the setupIntent directly to handleSetupIntentStatus
      await handleSetupIntentStatus(setupIntent.status, setupIntent.id)
    } catch (err) {
      console.error('Bank account setup error:', err)
      showErrorToast(err as Error)
    } finally {
      setIsLoading(false)
    }
  }

  const confirmSetup = async () => {
    if (!stripe) return

    setIsLoading(true)
    setErrorMessage(null)

    try {
      const { setupIntent, error } =
        await stripe.confirmUsBankAccountSetup(clientSecret)

      if (error) {
        setErrorMessage(error.message ?? 'Failed to confirm bank account')
        return
      }

      if (!setupIntent) {
        throw new Error('Failed to confirm bank account')
      }

      // Pass the setupIntent directly to handleSetupIntentStatus
      await handleSetupIntentStatus(setupIntent.status, setupIntent.id)
    } catch (err) {
      console.error('Bank account confirmation error:', err)
      setErrorMessage(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className={cn(
        'w-full',
        'px-4 md:px-6 lg:px-8',
        'md:max-w-none',
        'max-w-[500px] md:max-w-none',
        className
      )}
    >
      <AnimatePresence mode="wait">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="space-y-4"
        >
          {errorMessage && (
            <Alert variant="destructive" className="w-full">
              <AlertDescription className="text-sm md:text-base">
                {errorMessage}
              </AlertDescription>
            </Alert>
          )}

          <ProgressIndicator isLoading={isLoading} progress={progress} />

          <AnimatePresence mode="wait">
            <motion.div
              key={status}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full"
            >
              <StatusMessages status={status} bankDetails={bankDetails} />
            </motion.div>
          </AnimatePresence>

          <ActionButton
            status={status}
            isLoading={isLoading}
            onConfirm={confirmSetup}
            onSetup={setupBankAccount}
            disabled={isLoading || !stripe}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
