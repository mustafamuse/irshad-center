'use client'

import { useState } from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronRight, ChevronLeft, Loader2 } from 'lucide-react'
import { FormProvider, useForm } from 'react-hook-form'

import { toasts } from '@/components/toast/toast-utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClientLogger } from '@/lib/logger-client'

const logger = createClientLogger('ScholarshipForm')

import {
  applicantDetailsSchema,
  financialAssessmentSchema,
  scholarshipJustificationSchema,
  acknowledgementSchema,
  type ScholarshipApplicationData,
} from '../_schemas'
import AcknowledgementAgreement from './steps/acknowledgement'
import ApplicantDetails from './steps/applicant'
import FinancialAssessment from './steps/financial'
import ScholarshipJustification from './steps/justification'
import { SubmissionSuccess } from './success'
import { submitScholarshipApplication } from '../_actions'
import { useFormPersistence } from '../_hooks/use-form-persistence'

const steps = [
  {
    title: 'Student Details',
    component: ApplicantDetails,
    schema: applicantDetailsSchema,
  },
  {
    title: 'Background Information',
    component: FinancialAssessment,
    schema: financialAssessmentSchema,
  },
  {
    title: 'Application Purpose',
    component: ScholarshipJustification,
    schema: scholarshipJustificationSchema,
  },
  {
    title: 'Terms and Agreement',
    component: AcknowledgementAgreement,
    schema: acknowledgementSchema,
  },
]

export function ScholarshipForm() {
  const [currentStep, setCurrentStep] = useState(0)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const methods = useForm<ScholarshipApplicationData>({
    mode: 'onTouched',
    resolver: zodResolver(steps[currentStep].schema),
    defaultValues: {
      studentName: '',
      className: '',
      email: '',
      phone: '',
      siblingCount: 0,
      monthlyRate: 0,
      payer: undefined,
      payerRelation: '',
      payerName: '',
      payerPhone: '',
      educationStatus: undefined,
      schoolName: '',
      schoolYear: '',
      collegeName: '',
      collegeYear: '',
      qualifiesForFafsa: undefined,
      fafsaExplanation: '',
      householdSize: '',
      dependents: '',
      adultsInHousehold: '',
      livesWithBothParents: undefined,
      livingExplanation: '',
      isEmployed: undefined,
      monthlyIncome: null,
      termsAgreed: false,
    },
  })

  const { handleSubmit, trigger } = methods

  // Auto-save draft to localStorage
  const { clearDraft } = useFormPersistence(methods)

  const handleNext = async () => {
    const currentStepFields = {
      0: [
        'studentName',
        'className',
        'email',
        'phone',
        'payer',
        'payerRelation',
        'payerName',
        'payerPhone',
      ],
      1: [
        'educationStatus',
        'schoolName',
        'schoolYear',
        'collegeName',
        'collegeYear',
        'qualifiesForFafsa',
        'fafsaExplanation',
        'householdSize',
        'dependents',
        'adultsInHousehold',
        'livesWithBothParents',
        'livingExplanation',
        'isEmployed',
        'monthlyIncome',
      ],
      2: ['needJustification', 'goalSupport', 'commitment'],
      3: ['termsAgreed'],
    }[currentStep]

    const isStepValid = await trigger(
      currentStepFields as Array<keyof ScholarshipApplicationData>
    )

    if (isStepValid && currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1)
    }
  }

  const onSubmit = async () => {
    if (isSubmitting) return

    try {
      setIsSubmitting(true)

      // Validate all steps client-side first
      const validationResults = await Promise.all([
        trigger([
          'studentName',
          'className',
          'email',
          'phone',
          'payer',
          'payerRelation',
          'payerName',
          'payerPhone',
        ]),
        trigger([
          'educationStatus',
          'schoolName',
          'schoolYear',
          'collegeName',
          'collegeYear',
          'qualifiesForFafsa',
          'fafsaExplanation',
          'householdSize',
          'dependents',
          'adultsInHousehold',
          'livesWithBothParents',
          'livingExplanation',
          'isEmployed',
          'monthlyIncome',
        ]),
        trigger(['needJustification', 'goalSupport', 'commitment']),
        trigger(['termsAgreed']),
      ])

      const [
        isApplicantDetailsValid,
        isFinancialAssessmentValid,
        isJustificationValid,
        isAcknowledgementValid,
      ] = validationResults

      if (
        !isApplicantDetailsValid ||
        !isFinancialAssessmentValid ||
        !isJustificationValid ||
        !isAcknowledgementValid
      ) {
        const firstInvalidStep = validationResults.findIndex(
          (result) => !result
        )
        setCurrentStep(firstInvalidStep)
        setIsSubmitting(false)
        return
      }

      const formData = methods.getValues()

      toasts.success(
        'Submitting Application',
        'Generating your scholarship document...'
      )

      // Call Server Action
      const result = await submitScholarshipApplication(formData)

      if (!result.success) {
        toasts.apiError({
          title: 'Submission Failed',
          error: new Error(result.error || 'Please try again'),
        })
        setIsSubmitting(false)
        return
      }

      toasts.success('Success!', result.message || 'Application submitted')
      clearDraft() // Clear saved draft on successful submission
      setIsSubmitted(true)
    } catch (error) {
      logger.error('Form submission failed', error)
      toasts.apiError({
        title: 'Submission Failed',
        error: new Error('An unexpected error occurred. Please try again.'),
      })
      setIsSubmitting(false)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1)
    }
  }

  const CurrentStepComponent = steps[currentStep].component

  // If form is submitted, show confirmation message
  if (isSubmitted) {
    return (
      <SubmissionSuccess
        onReset={() => {
          methods.reset()
          setIsSubmitted(false)
          setIsSubmitting(false)
          setCurrentStep(0)
        }}
      />
    )
  }

  // Regular form render
  return (
    <FormProvider {...methods}>
      <div className="container mx-auto px-4 py-8">
        <Card className="mx-auto w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="text-center text-2xl font-bold">
              Financial Scholarship Assistance Application
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-8">
              <div className="mb-4 flex items-center justify-between">
                {steps.map((step, index) => (
                  <div key={index} className="flex flex-col items-center">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full ${
                        index <= currentStep
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {index + 1}
                    </div>
                    <span className="mt-1 hidden text-center text-xs sm:block">
                      {step.title}
                    </span>
                  </div>
                ))}
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300 ease-in-out"
                  style={{
                    width: `${((currentStep + 1) / steps.length) * 100}%`,
                  }}
                />
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)}>
              <CurrentStepComponent />
              <div className="mt-8 flex justify-between">
                <Button
                  type="button"
                  onClick={handlePrevious}
                  disabled={currentStep === 0}
                  variant="outline"
                  className="w-[120px]"
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Previous
                </Button>
                {currentStep === steps.length - 1 ? (
                  <Button
                    type="submit"
                    className="w-[120px]"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting
                      </>
                    ) : (
                      <>
                        Submit
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleNext}
                    className="w-[120px]"
                  >
                    Next
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </FormProvider>
  )
}
