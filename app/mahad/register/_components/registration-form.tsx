'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import type { GraduationStatus, PaymentFrequency } from '@prisma/client'
import { Loader2 } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'

import { ContactFields } from '@/components/registration/shared/ContactFields'
import { DateOfBirthMonthDayYearField } from '@/components/registration/shared/DateOfBirthMonthDayYearField'
import { NameFields } from '@/components/registration/shared/NameFields'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Form } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FormFieldWrapper } from '@/lib/registration/components/FormFieldWrapper'
import { useEmailValidation } from '@/lib/registration/hooks/use-email-validation'
import {
  mahadRegistrationSchema,
  type MahadRegistrationValues,
  MAHAD_GRADE_OPTIONS,
  MAHAD_DEFAULT_FORM_VALUES,
} from '@/lib/registration/schemas/mahad-registration'
import { SHOW_GRADE_SCHOOL } from '@/lib/registration/schemas/registration-field-schemas'
import {
  buttonClassNames,
  getInputClassNames,
} from '@/lib/registration/utils/form-utils'
import {
  formatMahadEstimate,
  formatMahadOptionPrice,
} from '@/lib/utils/mahad-registration-pricing'

import { useRegistration } from '../_hooks/use-registration'

const STUDENT_TYPE_OPTIONS = [
  { value: 'NON_GRADUATE', label: 'Current Student' },
  { value: 'GRADUATE', label: 'Graduate' },
] as const

const FREQUENCY_OPTIONS = [
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'BI_MONTHLY', label: 'Every 2 months' },
] as const

interface EstimatedPriceProps {
  graduationStatus?: GraduationStatus
  paymentFrequency?: PaymentFrequency
}

function EstimatedPrice({
  graduationStatus,
  paymentFrequency,
}: EstimatedPriceProps) {
  if (!graduationStatus || !paymentFrequency) return null

  const { label, savingsLabel } = formatMahadEstimate(
    graduationStatus,
    paymentFrequency
  )

  return (
    <div className="rounded-lg bg-teal-50 p-3 text-sm">
      <p className="font-medium text-teal-800">{label}</p>
      {savingsLabel ? (
        <p className="text-teal-600">{savingsLabel}</p>
      ) : null}
    </div>
  )
}

export function RegisterForm() {
  const form = useForm<MahadRegistrationValues>({
    resolver: zodResolver(mahadRegistrationSchema),
    defaultValues: MAHAD_DEFAULT_FORM_VALUES,
    mode: 'onBlur',
  })

  const { validateEmail, validateEmailImmediate, isCheckingEmail } =
    useEmailValidation(form)
  const { registerStudent, isSubmitting } = useRegistration({ form })

  const graduationStatus = useWatch({
    control: form.control,
    name: 'graduationStatus',
  })
  const paymentFrequency = useWatch({
    control: form.control,
    name: 'paymentFrequency',
  })

  const handleSubmit = async (data: MahadRegistrationValues) => {
    const isEmailValid = await validateEmailImmediate(data.email)
    if (!isEmailValid) return
    registerStudent(data)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="space-y-4"
        >
          <Card className="overflow-hidden rounded-2xl border-0 bg-white p-6 shadow-sm ring-1 ring-gray-200 md:p-8">
            <CardHeader className="mb-6 space-y-1 px-0 pb-6">
              <CardTitle className="text-xl font-semibold text-[#007078]">
                Personal Information
              </CardTitle>
              <CardDescription className="text-gray-600">
                Fill in your details to begin the registration process
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 px-0">
              <NameFields
                control={form.control}
                firstNameField="firstName"
                lastNameField="lastName"
                firstNameLabel="Legal First Name"
                lastNameLabel="Legal Last Name"
                firstNamePlaceholder="Enter your legal first name"
                lastNamePlaceholder="Enter your legal last name"
              />

              <ContactFields
                control={form.control}
                emailField="email"
                phoneField="phone"
                emailPlaceholder="Enter your email"
                phoneHelperText="Enter your whatsapp number"
                isCheckingEmail={isCheckingEmail}
                onEmailBlur={async (email) => {
                  await validateEmail(email)
                }}
              />

              <DateOfBirthMonthDayYearField
                control={form.control}
                fieldName="dateOfBirth"
              />

              {SHOW_GRADE_SCHOOL && (
                <>
                  <FormFieldWrapper
                    control={form.control}
                    name="gradeLevel"
                    label="Grade Level"
                    required
                  >
                    {(field, fieldState) => (
                      <Select
                        value={field.value || ''}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger
                          aria-invalid={!!fieldState.error}
                          className={getInputClassNames(!!fieldState.error)}
                        >
                          <SelectValue placeholder="Select grade level" />
                        </SelectTrigger>
                        <SelectContent>
                          {MAHAD_GRADE_OPTIONS.map((option) => (
                            <SelectItem
                              key={option.value}
                              value={option.value}
                            >
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </FormFieldWrapper>

                  <FormFieldWrapper
                    control={form.control}
                    name="schoolName"
                    label="School Name"
                    required
                  >
                    {(field, fieldState) => (
                      <Input
                        {...field}
                        value={field.value || ''}
                        placeholder="Enter school name"
                        aria-invalid={!!fieldState.error}
                        className={getInputClassNames(!!fieldState.error)}
                      />
                    )}
                  </FormFieldWrapper>
                </>
              )}

              <FormFieldWrapper
                control={form.control}
                name="graduationStatus"
                label="Student Type"
                required
              >
                {(field, fieldState) => (
                  <Select
                    value={field.value || ''}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger
                      aria-invalid={!!fieldState.error}
                      className={getInputClassNames(!!fieldState.error)}
                    >
                      <SelectValue placeholder="Select student type" />
                    </SelectTrigger>
                    <SelectContent>
                      {STUDENT_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                          {paymentFrequency &&
                            ` - ${formatMahadOptionPrice(option.value, paymentFrequency)}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormFieldWrapper>

              <FormFieldWrapper
                control={form.control}
                name="paymentFrequency"
                label="Payment Frequency"
                required
              >
                {(field, fieldState) => (
                  <Select
                    value={field.value || ''}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger
                      aria-invalid={!!fieldState.error}
                      className={getInputClassNames(!!fieldState.error)}
                    >
                      <SelectValue placeholder="Select payment frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                          {graduationStatus &&
                            ` - ${formatMahadOptionPrice(graduationStatus, option.value)}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormFieldWrapper>

              <EstimatedPrice
                graduationStatus={graduationStatus}
                paymentFrequency={paymentFrequency}
              />

              <Button
                type="submit"
                className={buttonClassNames.primary}
                disabled={isSubmitting || form.formState.isSubmitting}
                aria-busy={isSubmitting || form.formState.isSubmitting}
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2
                      className="h-5 w-5 animate-spin"
                      aria-hidden="true"
                    />
                    Registering...
                  </span>
                ) : (
                  'Register'
                )}
              </Button>
            </CardContent>
          </Card>
        </form>
      </Form>
    </div>
  )
}
