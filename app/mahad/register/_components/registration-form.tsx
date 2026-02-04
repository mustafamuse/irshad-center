'use client'

import Link from 'next/link'

import { zodResolver } from '@hookform/resolvers/zod'
import { Home, Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'

import { ContactFields } from '@/components/registration/shared/ContactFields'
import { DateOfBirthField } from '@/components/registration/shared/DateOfBirthField'
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
  SHOW_GRADE_SCHOOL,
} from '@/lib/registration/schemas/registration'
import {
  buttonClassNames,
  getInputClassNames,
} from '@/lib/registration/utils/form-utils'
import { BASE_RATES } from '@/lib/utils/mahad-tuition'

import { useRegistration } from '../_hooks/use-registration'

const STUDENT_TYPE_OPTIONS = [
  { value: 'NON_GRADUATE', label: 'Current Student' },
  { value: 'GRADUATE', label: 'Graduate' },
] as const

const FREQUENCY_OPTIONS = [
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'BI_MONTHLY', label: 'Every 2 months' },
] as const

function formatOptionPrice(
  gradStatus: keyof typeof BASE_RATES,
  freq: 'MONTHLY' | 'BI_MONTHLY'
) {
  const perMonth = BASE_RATES[gradStatus][freq] / 100
  if (freq === 'BI_MONTHLY') {
    const monthlyCost = BASE_RATES[gradStatus].MONTHLY / 100
    const savings = monthlyCost - perMonth
    return `$${perMonth * 2} (save $${savings}/mo)`
  }
  return `$${perMonth}/mo`
}

function EstimatedPrice({
  graduationStatus,
  paymentFrequency,
}: {
  graduationStatus?: string
  paymentFrequency?: string
}) {
  if (!graduationStatus || !paymentFrequency) return null

  const gradKey = graduationStatus as keyof typeof BASE_RATES
  const freqKey = paymentFrequency as 'MONTHLY' | 'BI_MONTHLY'
  const perMonth = BASE_RATES[gradKey]?.[freqKey]
  if (!perMonth) return null

  const isBiMonthly = freqKey === 'BI_MONTHLY'
  const dollars = perMonth / 100
  const label = isBiMonthly
    ? `Estimated: $${dollars * 2} every 2 months`
    : `Estimated: $${dollars}/month`

  const savings = isBiMonthly ? BASE_RATES[gradKey].MONTHLY / 100 - dollars : 0

  return (
    <div className="rounded-lg bg-teal-50 p-3 text-sm">
      <p className="font-medium text-teal-800">{label}</p>
      {savings > 0 && (
        <p className="text-teal-600">
          Save ${savings}/month vs monthly billing
        </p>
      )}
    </div>
  )
}

export function RegisterForm() {
  const form = useForm<MahadRegistrationValues>({
    resolver: zodResolver(mahadRegistrationSchema),
    defaultValues: MAHAD_DEFAULT_FORM_VALUES,
    mode: 'onBlur',
  })

  const { validateEmail, isCheckingEmail } = useEmailValidation(form)
  const { registerStudent, isSubmitting } = useRegistration({ form })

  const graduationStatus = form.watch('graduationStatus')
  const paymentFrequency = form.watch('paymentFrequency')

  const handleSubmit = async (data: MahadRegistrationValues) => {
    const isEmailValid = await validateEmail(data.email)
    if (!isEmailValid) return
    registerStudent(data)
  }

  return (
    <div className="min-h-screen bg-white px-4 pb-20 pt-4 md:px-6 md:py-8">
      <div className="mx-auto max-w-3xl space-y-4 md:space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link
              href="/mahad"
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 hover:text-primary"
            >
              <Home className="h-4 w-4" />
              <span>Home</span>
            </Link>
            <span>/</span>
            <span className="font-medium text-foreground">
              Student Registration
            </span>
          </div>
        </div>

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

                <DateOfBirthField
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
                              ` - ${formatOptionPrice(option.value, paymentFrequency as 'MONTHLY' | 'BI_MONTHLY')}`}
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
                              ` - ${formatOptionPrice(graduationStatus as keyof typeof BASE_RATES, option.value)}`}
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
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
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
    </div>
  )
}
