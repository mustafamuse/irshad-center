'use client'

import { useEffect, useRef, useState } from 'react'

import { UseFormReturn } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { EnrollmentFormValues } from '@/lib/schemas/enrollment'
import { cn } from '@/lib/utils'

interface TermsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAgree: (form: UseFormReturn<EnrollmentFormValues>) => void
  form: UseFormReturn<EnrollmentFormValues>
}

export function TermsModal({
  open,
  onOpenChange,
  onAgree,
  form,
}: TermsModalProps) {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const [_contentHeight, setContentHeight] = useState(0)
  const [_scrollPosition, setScrollPosition] = useState(0)

  // Reset scroll state when modal opens
  useEffect(() => {
    if (open) {
      setHasScrolledToBottom(false)
      setScrollPosition(0)
      // Get content height after modal opens
      if (contentRef.current) {
        setContentHeight(contentRef.current.scrollHeight)
      }
    }
  }, [open])

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const target = event.target as HTMLDivElement
    const scrollPosition = target.scrollTop + target.clientHeight
    const scrollHeight = target.scrollHeight
    setScrollPosition(scrollPosition)

    // Consider scrolled to bottom if within 20px of the bottom
    const isAtBottom = scrollHeight - scrollPosition <= 20
    if (isAtBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Terms and Conditions</DialogTitle>
          <DialogDescription>
            Please read and scroll through all terms and conditions to continue
          </DialogDescription>
        </DialogHeader>
        <ScrollArea
          className="h-[400px] pr-4"
          onScrollCapture={handleScroll}
          ref={contentRef}
        >
          <div className="space-y-4 text-sm text-muted-foreground">
            <p>Last updated: {new Date().toLocaleDateString()}</p>

            <h3 className="text-base font-semibold text-foreground">
              1. Enrollment Agreement
            </h3>
            <p>
              By enrolling in our autopay system, you agree to authorize
              automatic monthly payments for tuition fees. The payment will be
              processed on the 1st of each month.
            </p>

            <h3 className="text-base font-semibold text-foreground">
              2. Payment Terms
            </h3>
            <p>
              You authorize regular monthly charges to your credit card or bank
              account. You will be charged the monthly tuition amount for each
              enrolled student on the 1st of each month.
            </p>

            <h3 className="text-base font-semibold text-foreground">
              3. Cancellation Policy
            </h3>
            <p>
              To cancel the autopay enrollment, you must provide written notice
              at least 15 days before the next payment date. Cancellation
              requests received after this period will be effective for the
              following month's payment.
            </p>

            <h3 className="text-base font-semibold text-foreground">
              4. Failed Payments
            </h3>
            <p>
              If a payment fails, we will attempt to process it again within 3
              business days. Multiple failed payments may result in late fees
              and/or suspension of services. You will be held liable for paying
              any fees or penalties resulting from failed payments, including
              but not limited to late fees, bank fees, and/or administrative
              charges.
            </p>

            <h3 className="text-base font-semibold text-foreground">
              5. Refund Policy
            </h3>
            <p>
              Refunds are processed on a case-by-case basis. Please contact our
              administration office for refund requests. Note that no refunds
              will be provided after the first weekend of the billing cycle.
            </p>

            <h3 className="text-base font-semibold text-foreground">
              6. Changes to Terms
            </h3>
            <p>
              We reserve the right to modify these terms at any time. You will
              be notified of any changes via email.
            </p>

            <h3 className="text-base font-semibold text-foreground">
              7. Contact Information
            </h3>
            <p>
              For any questions or concerns about these terms, please contact
              our administration office.
            </p>
          </div>
        </ScrollArea>
        <DialogFooter className="flex-col gap-2">
          {!hasScrolledToBottom && (
            <p className="text-center text-sm text-muted-foreground">
              Please scroll to the bottom to accept the terms
            </p>
          )}
          <Button
            onClick={() => {
              onAgree(form)
              onOpenChange(false)
            }}
            className={cn(
              'w-full',
              !hasScrolledToBottom && 'cursor-not-allowed opacity-50'
            )}
            disabled={!hasScrolledToBottom}
          >
            I Agree to the Terms
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
