'use client'

import * as React from 'react'

import Link from 'next/link'

import { X, AlertCircle, ArrowRight, CreditCard } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

import { StripePricingTable } from './stripe-pricing-table'

export function PaymentBanner() {
  const [isOpen, setIsOpen] = React.useState(false)
  const [isDismissed, setIsDismissed] = React.useState(false)

  if (isDismissed) return null

  return (
    <>
      <div className="sticky top-0 z-50 bg-gradient-to-r from-[#007078] to-[#008891] shadow-lg">
        <div className="mx-auto max-w-7xl">
          <div className="relative flex items-center justify-between gap-2 px-3 py-3 sm:gap-4 sm:px-6 sm:py-4 lg:px-8">
            {/* Left side with icon and text */}
            <div className="flex flex-1 items-center justify-start">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                  <CreditCard className="h-4 w-4 text-white" />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:gap-1">
                  <p className="text-sm font-semibold leading-snug text-white sm:text-base">
                    Enrolled & want to pay tuition?
                  </p>
                  <p className="text-xs leading-snug text-white/90 sm:text-sm">
                    Setup auto-pay here
                  </p>
                </div>
              </div>
            </div>

            {/* Right side with buttons */}
            <div className="flex shrink-0 items-center gap-2 sm:gap-4">
              <Button
                variant="secondary"
                size="sm"
                className="whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[#007078] shadow-sm transition-all duration-200 hover:bg-white/90 sm:px-4 sm:py-2 sm:text-sm"
                onClick={() => setIsOpen(true)}
              >
                Setup Auto-Pay
              </Button>
              <button
                type="button"
                className="rounded-full p-1.5 text-white transition-colors duration-200 hover:bg-white/10"
                onClick={() => setIsDismissed(true)}
                aria-label="Dismiss banner"
              >
                <X className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
              </button>
            </div>

            {/* Decorative elements */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-white/[0.07] to-transparent" />
              <div className="absolute inset-y-0 right-0 w-1/4 bg-gradient-to-l from-white/[0.07] to-transparent" />
            </div>
          </div>
        </div>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader className="space-y-4 pb-6">
            <DialogTitle className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Setup Monthly Auto-Pay
            </DialogTitle>
            <DialogDescription className="text-base text-gray-600 sm:text-lg">
              For registered students only - Select your payment schedule below
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-[#007078]/10 bg-[#007078]/5 p-4 sm:p-6">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#007078]/10 sm:h-10 sm:w-10">
                <AlertCircle className="h-4 w-4 text-[#007078] sm:h-5 sm:w-5" />
              </div>
              <div className="space-y-2 sm:space-y-3">
                <h3 className="text-base font-semibold text-gray-900 sm:text-lg">
                  Not Registered Yet?
                </h3>
                <p className="text-sm text-gray-600 sm:text-base">
                  This payment setup is only for students who are already
                  registered and on our attendance list.
                </p>
                <Link
                  href="https://forms.gle/t38Jurtqes2pbBsVA"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-[#007078] hover:underline"
                  onClick={() => setIsOpen(false)}
                >
                  <span className="text-sm font-medium sm:text-base">
                    Register as a new student first
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-6 overflow-y-auto sm:mt-8">
            <h3 className="mb-4 text-base font-semibold text-gray-900 sm:mb-6 sm:text-lg">
              Select Your Payment Plan
            </h3>
            <div className="overflow-y-auto">
              <StripePricingTable />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
