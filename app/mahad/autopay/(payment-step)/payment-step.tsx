'use client'

import { Loader2 } from 'lucide-react'

import { EnrollmentStepsProgress } from '@/app/autopay/(enrollment)/enrollment-steps-progress'
import { useEnrollment } from '@/contexts/enrollment-context'

import { ClientPaymentForm } from './client-payment-form'
import { FAQSection } from './faq-section'

export function PaymentStep() {
  const {
    state: { step, selectedStudents, payorDetails, clientSecret },
    actions: { setStep },
  } = useEnrollment()

  const handleAddStudents = () => {
    setStep(1) // Go back to student selection step
  }

  // Skip rendering the form if we've moved past step 3
  if (step > 3) {
    return null
  }

  if (!clientSecret || !payorDetails) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <EnrollmentStepsProgress currentStep={2} />

      {/* Payment Form */}
      <ClientPaymentForm
        clientSecret={clientSecret}
        payorDetails={payorDetails}
        selectedStudents={selectedStudents}
        onAddStudents={handleAddStudents}
      />

      {/* FAQ Section */}
      <FAQSection />
    </div>
  )
}
