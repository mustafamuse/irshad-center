'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { StripePricingTable } from './stripe-pricing-table'

export function PricingDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="lg"
          className="rounded-full border-[#deb43e] px-8 text-[#deb43e] transition-all hover:bg-[#deb43e]/5"
        >
          Setup Auto-Pay
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Setup Automatic Payments</DialogTitle>
          <DialogDescription>
            Choose your preferred payment schedule below
          </DialogDescription>
        </DialogHeader>
        <StripePricingTable />
      </DialogContent>
    </Dialog>
  )
}
