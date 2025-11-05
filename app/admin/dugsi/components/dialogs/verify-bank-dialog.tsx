/**
 * Dugsi-specific wrapper for the shared VerifyBankDialog component.
 * Delegates to shared component with Dugsi-specific action.
 */

'use client'

import { VerifyBankDialog as SharedVerifyBankDialog } from '@/components/shared/verify-bank-dialog'

import { verifyDugsiBankAccount } from '../../actions'

interface VerifyBankDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  paymentIntentId: string
  parentEmail: string
}

export function VerifyBankDialog({
  open,
  onOpenChange,
  paymentIntentId,
  parentEmail,
}: VerifyBankDialogProps) {
  return (
    <SharedVerifyBankDialog
      open={open}
      onOpenChange={onOpenChange}
      paymentIntentId={paymentIntentId}
      contactEmail={parentEmail}
      program="DUGSI"
      onVerify={verifyDugsiBankAccount}
    />
  )
}
