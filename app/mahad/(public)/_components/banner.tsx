'use client'

import * as React from 'react'

import Link from 'next/link'

import { X, CreditCard } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export function PaymentBanner() {
  const [isDismissed, setIsDismissed] = React.useState(false)
  const [isHoveringDismiss, setIsHoveringDismiss] = React.useState(false)

  if (isDismissed) return null

  return (
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
              asChild
            >
              <Link href="/mahad/register">Setup Auto-Pay</Link>
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className={`relative rounded-full p-1.5 transition-all duration-300 ${
                      isHoveringDismiss
                        ? 'bg-white/20 ring-2 ring-white/30 ring-offset-2 ring-offset-[#007078]'
                        : 'hover:bg-white/10'
                    }`}
                    onClick={() => setIsDismissed(true)}
                    onMouseEnter={() => setIsHoveringDismiss(true)}
                    onMouseLeave={() => setIsHoveringDismiss(false)}
                    aria-label="Dismiss payment banner"
                  >
                    <X
                      className={`h-4 w-4 transition-all duration-300 sm:h-5 sm:w-5 ${isHoveringDismiss ? 'scale-110 text-white' : 'text-white/80'}`}
                      aria-hidden="true"
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Dismiss banner</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Decorative elements */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-white/[0.07] to-transparent" />
            <div className="absolute inset-y-0 right-0 w-1/4 bg-gradient-to-l from-white/[0.07] to-transparent" />
          </div>
        </div>
      </div>
    </div>
  )
}
