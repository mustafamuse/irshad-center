'use client'

import * as React from 'react'

import { AlertCircle } from 'lucide-react'

import { CheckoutForm } from '@/app/mahad/_components/checkout-form'
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
  profileId: string
  studentName: string
}

export function PaymentSuccessDialog({
  isOpen,
  onOpenChange,
  studentCount,
  profileId,
  studentName,
}: PaymentSuccessDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader className="space-y-2 pb-4">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#007078]/10">
            <AlertCircle className="h-5 w-5 text-[#007078]" />
          </div>
          <DialogTitle className="text-center text-xl font-bold tracking-tight text-gray-900">
            Complete Your Registration
          </DialogTitle>
          <DialogDescription className="text-center text-sm text-gray-600">
            {studentCount > 1
              ? `You're almost there! Set up automatic payments for ${studentCount} students to finalize registration.`
              : "You're almost there! Set up automatic payments to finalize your registration."}
          </DialogDescription>
        </DialogHeader>

        <div>
          <CheckoutForm profileId={profileId} studentName={studentName} />
        </div>

        <Alert
          variant="default"
          className="mt-4 border-[#deb43e]/20 bg-[#deb43e]/5 text-[#deb43e]"
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
