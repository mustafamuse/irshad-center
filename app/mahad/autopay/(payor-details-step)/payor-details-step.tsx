'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { EnrollmentStepsProgress } from '@/app/autopay/(enrollment)/enrollment-steps-progress'
import { PayorDetailsFields } from '@/app/autopay/(payor-details-step)/payor-details-fields'
import { TermsModal } from '@/app/autopay/(payor-details-step)/terms-modal'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Spinner } from '@/components/ui/spinner'
import { useEnrollment } from '@/contexts/enrollment-context'
import {
  enrollmentSchema,
  type EnrollmentFormValues,
  isApiError,
} from '@/lib/schemas/enrollment'
import { type Relationship } from '@/lib/types'

// Utility function to format phone numbers
function formatPhoneNumber(value: string): string {
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, '')

  // Format based on the number of digits
  if (digits.length <= 3) {
    return digits
  } else if (digits.length <= 6) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`
  } else if (digits.length <= 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`
  }

  // If more than 10 digits, truncate to 10
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`
}

export function PayorDetailsStep() {
  const {
    state: { selectedStudents, isTermsModalOpen, payorDetails, isProcessing },
    actions: {
      previousStep,
      nextStep,
      updatePayorDetails,
      handleTermsAgreement,
      toggleTermsModal,
      prepareSetup,
    },
  } = useEnrollment()

  const form = useForm<EnrollmentFormValues>({
    resolver: zodResolver(enrollmentSchema),
    defaultValues: {
      termsAccepted: false,
      students: selectedStudents.map((s) => s.id),
      ...payorDetails,
    },
    mode: 'onChange',
    reValidateMode: 'onChange',
  })

  const handleChange = (newValues: Partial<EnrollmentFormValues>) => {
    // Debug logging for all changes
    console.log('handleChange called with:', {
      newValues,
      currentFormValues: form.getValues(),
      selectedStudents,
      formState: {
        isDirty: form.formState.isDirty,
        isValid: form.formState.isValid,
        errors: form.formState.errors,
      },
    })

    // If relationship is changing to "self"
    if (newValues.relationship === 'self') {
      console.log('Self relationship selected:', {
        studentCount: selectedStudents.length,
        students: selectedStudents.map((s) => ({
          id: s.id,
          name: s.name,
          email: s.email,
          phone: s.phone,
        })),
      })

      // Only auto-fill if exactly one student is selected
      if (selectedStudents.length === 1) {
        const student = selectedStudents[0]

        console.log('Attempting to auto-fill with student data:', {
          student,
          hasEmail: Boolean(student.email),
          hasPhone: Boolean(student.phone),
          nameParts: student.name.split(' '),
        })

        // Validate student data before auto-filling
        if (!student.email || !student.phone) {
          console.log('Missing required student data:', {
            email: student.email,
            phone: student.phone,
            missingFields: {
              email: !student.email,
              phone: !student.phone,
            },
          })
          toast.error(
            'Some required information is missing from your student profile. Please fill in the details manually.',
            {
              description: [
                !student.email && 'Email address is missing',
                !student.phone && 'Phone number is missing',
              ]
                .filter(Boolean)
                .join(', '),
            }
          )
          // Still set relationship but don't auto-fill invalid data
          form.setValue('relationship', 'self')
          return
        }

        // Split name and validate
        const nameParts = student.name.split(' ')
        console.log('Name parsing:', {
          original: student.name,
          parts: nameParts,
          isValid: nameParts.length >= 2,
        })

        if (nameParts.length < 2) {
          toast.error(
            'Unable to auto-fill name fields. Please enter them manually.'
          )
          form.setValue('relationship', 'self')
          return
        }

        const [firstName, ...lastNameParts] = nameParts
        const lastName = lastNameParts.join(' ')

        // Format the phone number before setting it
        const formattedPhone = formatPhoneNumber(student.phone)

        const fieldsToSet = {
          relationship: 'self' as const,
          firstName,
          lastName,
          email: student.email,
          phone: formattedPhone,
        }

        console.log('Setting form values:', {
          fieldsToSet,
          previousValues: form.getValues(),
        })

        // Update form with validation
        Object.entries(fieldsToSet).forEach(([field, value]) => {
          form.setValue(field as keyof EnrollmentFormValues, value, {
            shouldValidate: true,
            shouldDirty: true,
            shouldTouch: true,
          })
        })

        // Show success message
        toast.success('Information auto-filled from your student profile')

        // After setting form values, sync with enrollment context
        const currentValues = form.getValues()
        updatePayorDetails({
          firstName: currentValues.firstName,
          lastName: currentValues.lastName,
          email: currentValues.email,
          phone: currentValues.phone,
          relationship: currentValues.relationship as Relationship,
        })
        return
      } else if (selectedStudents.length > 1) {
        toast.warning(
          'Auto-fill is only available when enrolling as a single student'
        )
        form.setValue('relationship', 'self')
        return
      }
    }

    // If changing from "self" to something else, clear the fields
    if (
      form.getValues('relationship') === 'self' &&
      newValues.relationship !== 'self'
    ) {
      const fieldsToReset = [
        'firstName',
        'lastName',
        'email',
        'phone',
      ] as const satisfies readonly (keyof EnrollmentFormValues)[]

      fieldsToReset.forEach((field) => {
        form.setValue(field, '', {
          shouldValidate: true,
          shouldDirty: true,
          shouldTouch: true,
        })
      })
      form.setValue('relationship', newValues.relationship as Relationship)

      // After resetting, sync with enrollment context
      updatePayorDetails({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        relationship: newValues.relationship as Relationship,
      })
    }

    // For other relationship changes
    if (newValues.relationship) {
      form.setValue('relationship', newValues.relationship as Relationship)

      // Sync the relationship change with context
      const currentValues = form.getValues()
      updatePayorDetails({
        ...currentValues,
        relationship: newValues.relationship as Relationship,
      })
    }

    // Log form state after all changes
    console.log('Form state after changes:', {
      values: form.getValues(),
      isDirty: form.formState.isDirty,
      isValid: form.formState.isValid,
      errors: form.formState.errors,
    })
  }

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      console.log('Submit handler:', {
        rawValues: values,
        termsAccepted: values.termsAccepted,
        firstName: {
          value: values.firstName,
          length: values.firstName ? values.firstName.length : 0,
          isEmpty: !values.firstName || values.firstName.trim() === '',
        },
        lastName: {
          value: values.lastName,
          length: values.lastName ? values.lastName.length : 0,
          isEmpty: !values.lastName || values.lastName.trim() === '',
        },
        formState: {
          isValid: form.formState.isValid,
          errors: form.formState.errors,
          dirtyFields: form.formState.dirtyFields,
        },
      })

      if (!values.termsAccepted) {
        console.log('Terms not accepted, showing toast')
        toast.error('Please accept the terms and conditions')
        return
      }

      const payload = {
        payerDetails: {
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
          phone: values.phone,
          relationship: values.relationship,
        },
        studentIds: selectedStudents.map((s) => s.id),
        termsAccepted: values.termsAccepted,
      }

      console.log('Sending payload:', payload)

      await prepareSetup(payload)
      nextStep()
    } catch (error) {
      console.error('Failed to prepare setup:', error)
      if (isApiError(error)) {
        toast.error(error.message)
      } else {
        toast.error('Failed to prepare setup. Please try again.')
      }
    }
  })

  console.log('Form State:', {
    values: form.getValues(),
    errors: form.formState.errors,
    isValid: form.formState.isValid,
    isDirty: form.formState.isDirty,
    touchedFields: form.formState.touchedFields,
  })

  return (
    <div>
      <EnrollmentStepsProgress currentStep={1} />
      <Card className="border-0 sm:border">
        <CardHeader className="space-y-2 p-4 sm:p-6">
          <CardTitle className="text-xl sm:text-2xl">Payor Details</CardTitle>
          <CardDescription className="text-sm sm:text-base">
            Enter the information of the person responsible for making the
            payments.
            {selectedStudents.length === 1
              ? " If you're paying for yourself, enter your own details."
              : ' This should be the parent/guardian if paying for children.'}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 p-4 sm:p-6">
            <PayorDetailsFields
              form={form}
              onRelationshipChange={handleChange}
            />

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="terms"
                  {...form.register('termsAccepted')}
                  checked={form.watch('termsAccepted')}
                  onCheckedChange={(checked) => {
                    console.log('Checkbox changed:', {
                      checked,
                      beforeValue: form.getValues('termsAccepted'),
                    })

                    form.setValue('termsAccepted', checked === true, {
                      shouldValidate: true,
                    })

                    console.log('After setValue:', {
                      formValue: form.getValues('termsAccepted'),
                      watchValue: form.watch('termsAccepted'),
                    })
                  }}
                />
                <label
                  htmlFor="terms"
                  className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  I agree to the{' '}
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 text-sm font-medium underline"
                    onClick={() => toggleTermsModal()}
                  >
                    Terms and Conditions
                  </Button>
                </label>
              </div>
              {form.formState.errors.termsAccepted && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.termsAccepted.message}
                </p>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex gap-4 p-4 sm:p-6">
            <Button
              type="button"
              variant="outline"
              className="h-12 flex-1 text-base font-medium"
              onClick={previousStep}
            >
              Back
            </Button>
            <Button
              type="submit"
              className="h-12 flex-1 text-base font-medium"
              disabled={isProcessing || !form.formState.isValid}
            >
              {isProcessing ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Processing...
                </>
              ) : (
                'Continue to Payment'
              )}
            </Button>
          </CardFooter>
        </form>

        <TermsModal
          open={isTermsModalOpen}
          onOpenChange={toggleTermsModal}
          onAgree={(form) => {
            handleTermsAgreement(form)
            form.setValue('termsAccepted', true, { shouldValidate: true })
          }}
          form={form}
        />
      </Card>
    </div>
  )
}
