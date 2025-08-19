'use client'

import { motion } from 'framer-motion'
import { Loader2, XCircle, AlertCircle } from 'lucide-react'

import { cn } from '@/lib/utils'

import { FormStatus } from './types'

interface StatusMessagesProps {
  status: FormStatus
  bankDetails?: {
    bankName?: string
    last4?: string
    routingNumber?: string
    accountType?: string
  } | null
}

export function StatusMessages({ status, bankDetails }: StatusMessagesProps) {
  console.log('Status Messages - Current Status:', status)

  const baseCardClass = cn(
    'rounded-lg md:rounded-xl',
    'p-3 md:p-4 lg:p-5',
    'border-2'
  )

  const baseBannerClass = cn(
    'space-y-1 md:space-y-2',
    'text-xs md:text-sm lg:text-base'
  )

  const baseIconClass = cn(
    'flex-shrink-0',
    'h-4 w-4 md:h-5 md:w-5 lg:h-6 lg:w-6'
  )

  const baseListClass = cn(
    'space-y-1 md:space-y-1.5 lg:space-y-2',
    'ml-3 md:ml-4 lg:ml-5 mt-2',
    'text-xs md:text-sm lg:text-base'
  )

  switch (status) {
    case 'processing':
      return (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-3 md:space-y-4 lg:space-y-5"
        >
          {/* Status Banner */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className={cn(baseCardClass, 'border-primary/50 bg-primary/10')}
          >
            <div className="flex items-start space-x-3">
              <Loader2
                className={cn(
                  baseIconClass,
                  'mt-0.5 flex-shrink-0 animate-spin text-primary'
                )}
              />
              <div className={baseBannerClass}>
                <h3 className="font-semibold text-primary">
                  Processing Your Setup
                </h3>
                <p className="text-muted-foreground">
                  Your bank account setup is complete! We're finalizing your
                  enrollment.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Detailed Explanation */}
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className={baseCardClass}
          >
            <h4 className="font-medium">Why this might have happened:</h4>
            <ul className={baseListClass}>
              <motion.li
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: 0.3 }}
              >
                The account details were entered incorrectly
              </motion.li>
              <motion.li
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: 0.4 }}
              >
                The bank account is not eligible for ACH payments
              </motion.li>
              <motion.li
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: 0.5 }}
              >
                The bank rejected the verification attempt
              </motion.li>
            </ul>
          </motion.div>

          {/* Action Guidance */}
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.6 }}
            className={baseCardClass}
          >
            <p className="font-medium text-primary">What to do next:</p>
            <p className="mt-1 text-muted-foreground">
              Click the button below to try again with your bank account
              details. Make sure to double-check all information.
            </p>
          </motion.div>
        </motion.div>
      )
    case 'requires_action':
      return (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-3 md:space-y-4 lg:space-y-5"
        >
          {/* Error Banner */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className={cn(
              baseCardClass,
              'border-destructive/50 bg-destructive/10'
            )}
          >
            <div className="flex items-start space-x-3">
              <XCircle
                className={cn(
                  baseIconClass,
                  'mt-0.5 flex-shrink-0 text-destructive'
                )}
              />
              <div className={baseBannerClass}>
                <h3 className="font-semibold text-destructive">
                  Bank Verification Failed
                </h3>
                <p className="text-muted-foreground">
                  We encountered an issue while verifying your bank account
                </p>
              </div>
            </div>
          </motion.div>

          {/* Detailed Explanation */}
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className={baseCardClass}
          >
            <h4 className="font-medium">Why this might have happened:</h4>
            <ul className={baseListClass}>
              <motion.li
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: 0.3 }}
              >
                The account details were entered incorrectly
              </motion.li>
              <motion.li
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: 0.4 }}
              >
                The bank account is not eligible for ACH payments
              </motion.li>
              <motion.li
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: 0.5 }}
              >
                The bank rejected the verification attempt
              </motion.li>
            </ul>
          </motion.div>

          {/* Action Guidance */}
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.6 }}
            className="rounded-lg bg-primary/5 p-4 text-sm"
          >
            <p className="font-medium text-primary">What to do next:</p>
            <p className="mt-1 text-muted-foreground">
              Click the button below to try again with your bank account
              details. Make sure to double-check all information.
            </p>
          </motion.div>
        </motion.div>
      )
    case 'requires_confirmation':
      return (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-3 md:space-y-4 lg:space-y-5"
        >
          {/* Status Banner */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className={cn(baseCardClass, 'border-primary/50 bg-primary/10')}
          >
            <div className="flex items-start space-x-3">
              <AlertCircle
                className={cn(
                  baseIconClass,
                  'mt-0.5 flex-shrink-0 text-primary'
                )}
              />
              <div className={baseBannerClass}>
                <h3 className="font-semibold text-primary">
                  Action Required: Review Bank Details
                </h3>
                <p className="text-muted-foreground">
                  Please review your bank account information below and click
                  confirm to proceed
                </p>
              </div>
            </div>
          </motion.div>

          {/* Bank Details */}
          {bankDetails && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className={cn(baseCardClass, 'bg-card')}
            >
              <h4 className="font-medium">Bank Account Details:</h4>
              <ul className={baseListClass}>
                <motion.li
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: 0.3 }}
                  className="flex items-center justify-between"
                >
                  <span className="text-muted-foreground">Bank Name:</span>
                  <span className="font-medium">
                    {bankDetails.bankName || 'Not available'}
                  </span>
                </motion.li>
                <motion.li
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: 0.4 }}
                  className="flex items-center justify-between"
                >
                  <span className="text-muted-foreground">Account Type:</span>
                  <span className="font-medium capitalize">
                    {bankDetails.accountType || 'Not available'}
                  </span>
                </motion.li>
                <motion.li
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: 0.5 }}
                  className="flex items-center justify-between"
                >
                  <span className="text-muted-foreground">Account Number:</span>
                  <span className="font-medium">
                    ••••{bankDetails.last4 || '****'}
                  </span>
                </motion.li>
                <motion.li
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: 0.6 }}
                  className="flex items-center justify-between"
                >
                  <span className="text-muted-foreground">Routing Number:</span>
                  <span className="font-medium">
                    {bankDetails.routingNumber || 'Not available'}
                  </span>
                </motion.li>
              </ul>
            </motion.div>
          )}

          {/* Action Guidance */}
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.4 }}
            className={baseCardClass}
          >
            <p className="font-medium text-primary">Next Steps:</p>
            <p className="mt-1 text-muted-foreground">
              <span className="font-medium">1.</span> Verify bank details are
              correct
              <br />
              <span className="font-medium">2.</span> Confirm below to proceed
            </p>
          </motion.div>
        </motion.div>
      )
    default:
      return null
  }
}
