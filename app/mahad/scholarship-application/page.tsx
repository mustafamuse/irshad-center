'use client'

import { useState } from 'react'

import dynamic from 'next/dynamic'

import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronRight, ChevronLeft } from 'lucide-react'
import ReactDOM from 'react-dom/client'
import { FormProvider, useForm } from 'react-hook-form'

import { toasts } from '@/components/toast/toast-utils'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'

import AcknowledgementAgreement from './acknowledgement-agreement'
import ApplicantDetails from './applicant-details'
import FinancialAssessment from './financial-assessment'
import {
  applicantDetailsSchema,
  financialAssessmentSchema,
  scholarshipJustificationSchema,
  acknowledgementSchema,
  ScholarshipApplicationData,
} from './schemas'
import ScholarshipJustification from './scholarship-justification'

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

export default function ScholarshipApplication() {
  const [currentStep, setCurrentStep] = useState(0)
  const [isSubmitted, setIsSubmitted] = useState(false)

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

  const {
    handleSubmit,
    trigger,
    formState: { errors },
  } = methods

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

    const isStepValid = await trigger(currentStepFields)

    if (isStepValid) {
      const formData = methods.getValues()

      if (currentStep === 0) {
        console.log('Applicant Details Step Data:', {
          studentName: formData.studentName,
          className: formData.className,
          email: formData.email,
          phone: formData.phone,
          payer: formData.payer,
          payerRelation: formData.payerRelation,
          payerName: formData.payerName,
          payerPhone: formData.payerPhone,
          siblingCount: formData.siblingCount,
          monthlyRate: formData.monthlyRate,
        })
      } else if (currentStep === 1) {
        console.log('Financial Assessment Step Data:', {
          educationStatus: formData.educationStatus,
          schoolName: formData.schoolName,
          schoolYear: formData.schoolYear,
          collegeName: formData.collegeName,
          collegeYear: formData.collegeYear,
          qualifiesForFafsa: formData.qualifiesForFafsa,
          fafsaExplanation: formData.fafsaExplanation,
          householdSize: formData.householdSize,
          dependents: formData.dependents,
          adultsInHousehold: formData.adultsInHousehold,
          livesWithBothParents: formData.livesWithBothParents,
          livingExplanation: formData.livingExplanation,
          isEmployed: formData.isEmployed,
          monthlyIncome: formData.monthlyIncome,
        })
      }

      if (currentStep < steps.length - 1) {
        setCurrentStep((prev) => prev + 1)
      }
    } else {
      console.log(
        `Step ${currentStep + 1} Validation Errors:`,
        Object.keys(errors)
          .filter((key) => currentStepFields?.includes(key))
          .reduce<Record<string, unknown>>((obj, key) => {
            obj[key] = errors[key]
            return obj
          }, {})
      )
    }
  }

  const onSubmit = async () => {
    try {
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
        return
      }

      // Get the complete form data
      const formData = methods.getValues()

      // Format the data for PDF
      const formattedData = {
        'Applicant Details': {
          studentName: formData.studentName,
          className: formData.className,
          email: formData.email,
          phone: formData.phone,
          payer: formData.payer,
          ...(formData.payer === 'relative' && {
            payerRelation: formData.payerRelation,
            payerName: formData.payerName,
            payerPhone: formData.payerPhone,
          }),
          siblingCount: formData.siblingCount,
          monthlyRate: formData.monthlyRate,
        },
        'Financial Assessment': {
          educationStatus: formData.educationStatus,
          ...(formData.educationStatus === 'highschool' && {
            schoolName: formData.schoolName,
            schoolYear: formData.schoolYear,
          }),
          ...(formData.educationStatus === 'college' && {
            collegeName: formData.collegeName,
            collegeYear: formData.collegeYear,
            qualifiesForFafsa: formData.qualifiesForFafsa,
            ...(formData.qualifiesForFafsa === 'no' && {
              fafsaExplanation: formData.fafsaExplanation,
            }),
          }),
          householdSize: formData.householdSize,
          dependents: formData.dependents,
          adultsInHousehold: formData.adultsInHousehold,
          livesWithBothParents: formData.livesWithBothParents,
          ...(formData.livesWithBothParents === 'no' && {
            livingExplanation: formData.livingExplanation,
          }),
          isEmployed: formData.isEmployed,
          ...(formData.isEmployed === 'yes' && {
            monthlyIncome: formData.monthlyIncome,
          }),
        },
        'Scholarship Justification': {
          needJustification: formData.needJustification,
          goalSupport: formData.goalSupport,
          commitment: formData.commitment,
          ...(formData.additionalInfo && {
            additionalInfo: formData.additionalInfo,
          }),
        },
        'Terms Agreement': {
          termsAgreed: formData.termsAgreed,
        },
      }

      // Show initial toast
      toasts.success(
        'Application Submitted',
        'Generating your scholarship document...'
      )

      // Store the form data in localStorage
      localStorage.setItem('scholarshipData', JSON.stringify(formattedData))

      // Set submitted state to show confirmation
      setIsSubmitted(true)

      // Create and mount PDF component once
      const ScholarshipPDF = dynamic(() => import('./pdf-preview'), {
        ssr: false,
      })

      // Create a container that will be removed
      const container = document.createElement('div')
      container.style.display = 'none' // Make sure it's hidden
      document.body.appendChild(container)

      const root = ReactDOM.createRoot(container)
      root.render(<ScholarshipPDF data={formattedData} />)

      // Clean up after PDF generation and email are handled
      setTimeout(() => {
        root.unmount() // Properly unmount the React component
        document.body.removeChild(container)
        localStorage.removeItem('scholarshipData')
      }, 5000) // Increased timeout to ensure PDF generation and email are complete
    } catch (error) {
      console.error('Form submission failed:', error)
      toasts.apiError({
        title: 'Submission Failed',
        error: new Error('Please check all fields and try again.'),
      })
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
      <div className="container mx-auto px-4 py-16">
        <Card className="mx-auto w-full max-w-2xl border-green-100 bg-white shadow-lg">
          <CardHeader className="space-y-6 border-b border-green-100 pb-8">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <svg
                className="h-8 w-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <div className="space-y-2 text-center">
              <CardTitle className="text-2xl font-bold text-green-600">
                Application Submitted Successfully
              </CardTitle>
              <CardDescription className="text-lg text-gray-600">
                Thank you for applying for the scholarship program
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-8 p-8">
            <div className="rounded-lg bg-green-50/50 p-6">
              <div className="space-y-4">
                <p className="text-gray-700">
                  Your application has been received and will be reviewed by the
                  Mahad.
                </p>
                <div className="mt-6 rounded-md bg-white p-4 shadow-sm">
                  <p className="text-sm font-medium text-gray-900">
                    Next Steps:
                  </p>
                  <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-gray-600">
                    <li>Application review by the Mahad Office</li>
                    <li>Evaluation of financial need and circumstances</li>
                    <li>Decision notification via email/in-person</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="space-y-4 text-center">
              <p className="text-sm text-gray-600">
                If you have any questions, please contact the Mahad Office
                directly
              </p>
              <Button
                variant="outline"
                className="mt-4 border-green-200 hover:bg-green-50 hover:text-green-600"
                onClick={() => {
                  methods.reset()
                  setIsSubmitted(false)
                  setCurrentStep(0)
                }}
              >
                Submit Another Application
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
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
                  <Button type="submit" className="w-[120px]">
                    Submit
                    <ChevronRight className="ml-2 h-4 w-4" />
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
