'use client'

import { Clock, LogIn, MapPin, User } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface OnboardingModalProps {
  open: boolean
  onDismiss: () => void
}

const steps = [
  {
    icon: User,
    title: 'Select Your Name',
    description: 'Choose yourself from the dropdown list',
  },
  {
    icon: MapPin,
    title: 'Enable Location',
    description: 'Tap "Get Location" so we can verify you\'re at the center',
  },
  {
    icon: LogIn,
    title: 'Clock In',
    description: 'Press the Clock In button to start your shift',
  },
]

export function OnboardingModal({ open, onDismiss }: OnboardingModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onDismiss()}>
      <DialogContent className="max-w-sm gap-0 overflow-hidden p-0">
        <div className="bg-gradient-to-br from-[#007078] to-[#005a61] px-6 py-8 text-center text-white">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 ring-4 ring-[#deb43e]/40 backdrop-blur-sm">
            <Clock className="h-8 w-8" />
          </div>
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-2xl font-bold text-white">
              Welcome to Check-in
            </DialogTitle>
            <DialogDescription className="text-white/80">
              Follow these 3 simple steps to clock in for your shift
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-1 p-6">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="flex items-start gap-4 rounded-xl p-3 transition-colors hover:bg-[#007078]/5"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#007078] text-sm font-bold text-white ring-2 ring-[#deb43e]/30">
                {index + 1}
              </div>
              <div className="flex-1 pt-1">
                <div className="flex items-center gap-2">
                  <step.icon className="h-4 w-4 text-[#007078]" />
                  <h3 className="font-semibold text-gray-900">{step.title}</h3>
                </div>
                <p className="mt-0.5 text-sm text-gray-600">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t bg-gray-50 px-6 py-4">
          <Button
            onClick={onDismiss}
            className="h-12 w-full bg-[#007078] text-base shadow-lg shadow-[#007078]/25 transition-all hover:bg-[#005a61] hover:shadow-xl hover:ring-2 hover:ring-[#deb43e]/50 active:scale-[0.98]"
          >
            Got it, let's start
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
