'use client'

import { VisuallyHidden } from '@radix-ui/react-visually-hidden'

import { DonationForm } from '@/app/donate/_components/donation-form'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

interface DonateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DonateDialog({ open, onOpenChange }: DonateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto border-none bg-transparent p-0 px-4 shadow-none sm:max-w-md sm:px-0">
        <VisuallyHidden>
          <DialogTitle>Donate to Irshad Center</DialogTitle>
        </VisuallyHidden>
        <DonationForm />
      </DialogContent>
    </Dialog>
  )
}
