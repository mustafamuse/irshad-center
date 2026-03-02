'use client'

import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { X } from 'lucide-react'

import { DonationForm } from '@/app/donate/_components/donation-form'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'

interface DonateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DonateDialog({ open, onOpenChange }: DonateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto border-none bg-transparent p-0 px-4 shadow-none sm:max-w-md sm:px-0 [&>button:last-child]:hidden">
        <VisuallyHidden>
          <DialogTitle>Donate to Irshad Center</DialogTitle>
        </VisuallyHidden>
        <div className="relative">
          <DialogClose className="absolute right-3 top-3 z-10 rounded-sm opacity-70 transition-opacity hover:opacity-100">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
          <DonationForm />
        </div>
      </DialogContent>
    </Dialog>
  )
}
