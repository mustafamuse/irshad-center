'use client'

import { LogIn, MapPin, User } from 'lucide-react'

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
  { icon: User, title: 'Select your name' },
  { icon: MapPin, title: 'Tap "Get Location"' },
  { icon: LogIn, title: 'Clock in' },
]

export function OnboardingModal({ open, onDismiss }: OnboardingModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onDismiss()}>
      <DialogContent className="max-w-xs gap-0 p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>How to Check In</DialogTitle>
        </DialogHeader>

        <div className="space-y-1 p-4">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="flex items-center gap-3 rounded-lg p-2"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#007078] text-xs font-bold text-white">
                {index + 1}
              </div>
              <div className="flex items-center gap-2">
                <step.icon className="h-4 w-4 text-[#007078]" />
                <span className="text-sm">{step.title}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t px-6 py-4">
          <Button
            onClick={onDismiss}
            className="w-full bg-[#007078] hover:bg-[#005a61]"
          >
            Start
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
