import React from 'react'

import { BadgeCheck, Banknote, UserRound } from 'lucide-react'

interface StepsProgressProps {
  currentStep: number
}

export function EnrollmentStepsProgress({ currentStep }: StepsProgressProps) {
  // Convert 0-based step to 1-based for visual representation
  const displayStep = currentStep + 1

  const steps = [
    { id: 1, label: 'Student Info', icon: UserRound },
    { id: 2, label: 'Contact Info', icon: UserRound },
    { id: 3, label: 'Payment Setup', icon: Banknote },
  ]

  return (
    <div className="flex justify-center px-4">
      <div className="flex w-full max-w-md items-center justify-between">
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            {/* Step Circle */}
            <div className="flex flex-col items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                  displayStep > step.id
                    ? 'bg-green-100 text-green-600'
                    : displayStep === step.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {displayStep > step.id ? (
                  <BadgeCheck className="h-5 w-5" />
                ) : (
                  <step.icon className="h-5 w-5" />
                )}
              </div>
              {/* Step Label - Hide on mobile */}
              <span
                className={`hidden text-xs font-medium sm:block ${
                  displayStep >= step.id
                    ? 'text-foreground'
                    : 'text-muted-foreground'
                }`}
              >
                {step.label}
              </span>
            </div>

            {/* Connector Line - Don't show after last step */}
            {index < steps.length - 1 && (
              <div className="h-[2px] flex-1 bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width:
                      displayStep > step.id
                        ? '100%'
                        : displayStep === step.id
                          ? '50%'
                          : '0%',
                  }}
                />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}
