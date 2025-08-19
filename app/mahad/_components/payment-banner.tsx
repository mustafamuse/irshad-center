'use client'

import * as React from 'react'

import Link from 'next/link'

import { X, AlertCircle, ArrowRight } from 'lucide-react'

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
          <div className="relative flex items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            {/* Left side with icon and text */}
            <div className="flex flex-1 items-center justify-center sm:justify-start">
              <div className="hidden sm:flex sm:items-center sm:gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                  <svg
                    className="h-4 w-4 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              </div>
              <p className="text-center text-sm font-medium text-white sm:ml-4 sm:text-base">
                <span className="font-semibold">
                  Enrolled & want to pay tuition?
                </span>{' '}
                <span className="hidden sm:inline">
                  Setup your automatic payments here
                </span>
              </p>
            </div>

            {/* Right side with buttons */}
            <div className="flex shrink-0 items-center gap-3 sm:gap-4">
              <Button
                variant="secondary"
                size="sm"
                className="rounded-full bg-white px-4 py-2 text-sm font-medium text-[#007078] shadow-sm transition-all duration-200 hover:bg-white/90"
                onClick={() => setIsOpen(true)}
              >
                Setup Auto-Pay
              </Button>
              <button
                type="button"
                className="rounded-full p-1.5 text-white transition-colors duration-200 hover:bg-white/10"
                onClick={() => setIsDismissed(true)}
              >
                <span className="sr-only">Dismiss</span>
                <X className="h-5 w-5" aria-hidden="true" />
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
        <DialogContent className="max-w-4xl">
          <DialogHeader className="space-y-4 pb-6">
            <DialogTitle className="text-3xl font-bold tracking-tight text-gray-900">
              Setup Monthly Auto-Pay
            </DialogTitle>
            <DialogDescription className="text-lg text-gray-600">
              For registered students only - Select your payment schedule below
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-[#007078]/10 bg-[#007078]/5 p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#007078]/10">
                <AlertCircle className="h-5 w-5 text-[#007078]" />
              </div>
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900">
                  Not Registered Yet?
                </h3>
                <p className="text-gray-600">
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
                  <span className="font-medium">
                    Register as a new student first
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <h3 className="mb-6 text-lg font-semibold text-gray-900">
              Select Your Payment Plan
            </h3>
            <StripePricingTable />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
