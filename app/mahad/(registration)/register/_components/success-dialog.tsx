'use client'

import * as React from 'react'

import { CheckCircle2, AlertCircle } from 'lucide-react'

import { StripePricingTable } from '@/app/mahad/_components/stripe-pricing-table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

interface PaymentSuccessDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  studentCount: number
}

export function PaymentSuccessDialog({
  isOpen,
  onOpenChange,
  studentCount,
}: PaymentSuccessDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader className="space-y-4 pb-6">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#007078]/10">
            <AlertCircle className="h-6 w-6 text-[#007078]" />
          </div>
          <DialogTitle className="text-center text-2xl font-bold tracking-tight text-gray-900">
            Complete Your Registration
          </DialogTitle>
          <DialogDescription className="text-center text-base text-gray-600">
            {studentCount > 1
              ? `You're almost there! Set up automatic payments for ${studentCount} students to finalize registration.`
              : "You're almost there! Set up automatic payments to finalize your registration."}
          </DialogDescription>
        </DialogHeader>

        <div className="mb-8 rounded-lg border border-[#007078]/10 bg-[#007078]/5 p-4">
          <div className="flex flex-col gap-3">
            <h3 className="font-semibold text-[#007078]">
              Important Registration Information
            </h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[#007078]" />
                <span>
                  Registration is only complete after setting up automatic
                  monthly payments
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[#007078]" />
                <span>
                  Students will be added to the attendance list once auto-pay is
                  confirmed
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[#007078]" />
                <span>Secure payment processing through Stripe</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[#007078]" />
                <span>
                  You'll receive email confirmation once setup is complete
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div>
          <h3 className="mb-6 text-lg font-semibold text-gray-900">
            Select Your Payment Plan
          </h3>
          <StripePricingTable />
        </div>

        <Alert
          variant="default"
          className="mt-6 border-[#deb43e]/20 bg-[#deb43e]/5 text-[#deb43e]"
        >
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Your registration will remain pending until auto-pay setup is
            complete
          </AlertDescription>
        </Alert>
      </DialogContent>
    </Dialog>
  )
}
