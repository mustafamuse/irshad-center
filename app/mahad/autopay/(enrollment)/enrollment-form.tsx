'use client'

import { Footer } from '@/components/footer'
import { GeometricPattern } from '@/components/ui/geometric-pattern'
import {
  EnrollmentProvider,
  useEnrollment,
} from '@/contexts/enrollment-context'

import { EnrollmentHeader } from './enrollment-header'
import { PaymentStep } from '../(payment-step)/payment-step'
import { PayorDetailsStep } from '../(payor-details-step)/payor-details-step'
import { StudentSelectionStep } from '../(student-selection-step)/student-selection-step'

export function EnrollmentForm() {
  return (
    <EnrollmentProvider>
      <div className="relative space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="relative mb-8 text-center sm:mb-12">
          <GeometricPattern className="absolute left-1/2 top-0 -z-10 h-40 w-40 -translate-x-1/2 rotate-90 opacity-5 sm:h-64 sm:w-64" />
          <EnrollmentHeader />
        </div>

        {/* Progress Steps */}
        <div className="mx-auto max-w-3xl">
          <EnrollmentSteps />
        </div>

        {/* Footer */}
        <div className="mt-4 sm:mt-8">
          <Footer showButtons={true} />
        </div>
      </div>
    </EnrollmentProvider>
  )
}

function EnrollmentSteps() {
  const { state } = useEnrollment()

  console.log('EnrollmentSteps render', {
    currentStep: state.step,
    selectedStudents: state.selectedStudents,
  })

  // Render the appropriate step based on state.step
  switch (state.step) {
    case 0:
      return <StudentSelectionStep />
    case 1:
      return <PayorDetailsStep />
    case 2:
      return <PaymentStep />
    default:
      return null
  }
}
