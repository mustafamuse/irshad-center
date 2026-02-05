'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface OnboardingModalProps {
  open: boolean
  onDismiss: () => void
}

const steps = [
  'Select your name',
  'Allow location access when asked',
  'Clock in at the start of your shift',
  'Clock out before you leave',
]

export function OnboardingModal({ open, onDismiss }: OnboardingModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onDismiss()}>
      <DialogContent className="max-w-xs gap-0 p-0">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle className="text-base">How to Check In</DialogTitle>
        </DialogHeader>

        <ol className="space-y-0 px-5 py-4">
          {steps.map((step, index) => (
            <li key={step} className="flex gap-3 pb-4 last:pb-0">
              <div className="flex flex-col items-center">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#007078] text-xs font-semibold text-white">
                  {index + 1}
                </div>
                {index < steps.length - 1 && (
                  <div className="mt-1 h-full w-px bg-[#007078]/20" />
                )}
              </div>
              <span className="pt-0.5 text-sm leading-snug">{step}</span>
            </li>
          ))}
        </ol>

        <div className="border-t px-5 py-4">
          <Button
            onClick={onDismiss}
            className="w-full bg-[#007078] hover:bg-[#005a61]"
          >
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
