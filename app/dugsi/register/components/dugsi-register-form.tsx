'use client'

import { useState } from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import { UserPlus, X, Users, Loader2 } from 'lucide-react'
import { useFieldArray, useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { ContactFields } from '@/components/registration/shared/ContactFields'
import { DateOfBirthField } from '@/components/registration/shared/DateOfBirthField'
import { EducationFields } from '@/components/registration/shared/EducationFields'
import { NameFields } from '@/components/registration/shared/NameFields'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Form } from '@/components/ui/form'
import { Label } from '@/components/ui/label'
import { SchoolCombobox } from '@/components/ui/school-combobox'
import { Textarea } from '@/components/ui/textarea'
import { FormFieldWrapper } from '@/lib/registration/components/FormFieldWrapper'
import {
  dugsiRegistrationSchema,
  type DugsiRegistrationValues,
  DUGSI_DEFAULT_FORM_VALUES,
  DEFAULT_CHILD_VALUES,
  DUGSI_EDUCATION_OPTIONS,
  DUGSI_GRADE_OPTIONS,
} from '@/lib/registration/schemas/registration'
import {
  buttonClassNames,
  getInputClassNames,
} from '@/lib/registration/utils/form-utils'
import { cn } from '@/lib/utils'

import { PaymentSuccessDialog } from '../../../mahad/register/components/payment-success-dialog'
import { registerDugsiChildren } from '../actions'

export function DugsiRegisterForm() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [studentCount, setStudentCount] = useState(0)

  const form = useForm<DugsiRegistrationValues>({
    resolver: zodResolver(dugsiRegistrationSchema),
    defaultValues: DUGSI_DEFAULT_FORM_VALUES,
    mode: 'onChange',
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'children',
  })

  // Watch isSingleParent to show/hide parent 2 fields
  const isSingleParent = form.watch('isSingleParent')

  const onSubmit = async (data: DugsiRegistrationValues) => {
    if (isSubmitting) return

    setIsSubmitting(true)

    try {
      const result = await registerDugsiChildren(data)

      if (result.success) {
        toast.success(
          `Successfully enrolled ${data.children.length} ${data.children.length === 1 ? 'child' : 'children'}!`
        )
        form.reset()
        setStudentCount(data.children.length)
        setShowPaymentDialog(true)
      }
    } catch (error) {
      console.error('Registration failed:', error)
      toast.error(
        error instanceof Error
          ? error.message
          : 'Registration failed. Please try again.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddChild = () => {
    append(DEFAULT_CHILD_VALUES)
  }

  const handleRemoveChild = (index: number) => {
    if (fields.length > 1) {
      remove(index)
    }
  }

  return (
    <>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-6 sm:space-y-8"
        >
          {/* Parent/Guardian Information Section */}
          <Card className="rounded-xl border-0 bg-white shadow-sm ring-1 ring-gray-200 sm:rounded-2xl">
            <CardHeader className="space-y-2 border-b p-4 sm:p-6">
              <CardTitle className="text-xl font-semibold text-[#007078] sm:text-2xl">
                Parent Information
              </CardTitle>
              <CardDescription className="text-sm text-gray-600 sm:text-base">
                Primary contact for registration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-4 sm:space-y-8 sm:p-6">
              {/* Parent/Guardian 1 */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-[#007078] sm:h-5 sm:w-5" />
                  <h3 className="text-base font-semibold text-[#007078] sm:text-lg">
                    Parent 1
                  </h3>
                </div>
                <NameFields
                  control={form.control}
                  firstNameField="parent1FirstName"
                  lastNameField="parent1LastName"
                />

                <ContactFields
                  control={form.control}
                  emailField="parent1Email"
                  phoneField="parent1Phone"
                  emailPlaceholder="parent@example.com"
                  onPhoneChange={(formatted) =>
                    form.setValue('parent1Phone', formatted)
                  }
                />
              </div>

              {/* Single Parent Checkbox */}
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="isSingleParent"
                  checked={isSingleParent}
                  onCheckedChange={(checked) => {
                    form.setValue('isSingleParent', checked as boolean)
                    // Note: We don't clear Parent 2 fields here to prevent accidental data loss
                    // The server will ignore Parent 2 fields if isSingleParent is true
                  }}
                  className="mt-0.5"
                />
                <Label
                  htmlFor="isSingleParent"
                  className="cursor-pointer text-xs font-medium leading-snug peer-disabled:cursor-not-allowed peer-disabled:opacity-70 sm:text-sm"
                >
                  Single parent household
                </Label>
              </div>

              {/* Parent/Guardian 2 - Conditional */}
              {!isSingleParent && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-[#007078] sm:h-5 sm:w-5" />
                    <h3 className="text-base font-semibold text-[#007078] sm:text-lg">
                      Parent 2
                    </h3>
                  </div>
                  <NameFields
                    control={form.control}
                    firstNameField="parent2FirstName"
                    lastNameField="parent2LastName"
                    required={!isSingleParent}
                  />

                  <ContactFields
                    control={form.control}
                    emailField="parent2Email"
                    phoneField="parent2Phone"
                    emailPlaceholder="parent@example.com"
                    required={!isSingleParent}
                    onPhoneChange={(formatted) =>
                      form.setValue('parent2Phone', formatted)
                    }
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Children Section */}
          <Card className="rounded-xl border-0 bg-white shadow-sm ring-1 ring-gray-200 sm:rounded-2xl">
            <CardHeader className="space-y-2 border-b p-4 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-xl font-semibold text-[#007078] sm:text-2xl">
                    Children
                  </CardTitle>
                  <CardDescription className="mt-1 text-sm text-gray-600 sm:mt-2 sm:text-base">
                    Add each child to enroll
                  </CardDescription>
                </div>
                <div className="self-start rounded-full bg-[#007078]/10 px-3 py-1.5 sm:px-4 sm:py-2">
                  <span className="whitespace-nowrap text-xs font-medium text-[#007078] sm:text-sm">
                    {fields.length} {fields.length === 1 ? 'child' : 'children'}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:space-y-6 sm:p-6">
              {fields.map((field, index) => (
                <Card
                  key={field.id}
                  className="relative overflow-hidden rounded-lg border-2 border-gray-200 sm:rounded-xl"
                >
                  <CardHeader className="border-b bg-gray-50/50 p-3 sm:p-4 sm:pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-medium text-[#007078] sm:text-lg">
                        Child #{index + 1}
                      </CardTitle>
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveChild(index)}
                          className="h-7 w-7 text-gray-400 hover:bg-red-50 hover:text-red-500 sm:h-8 sm:w-8"
                        >
                          <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          <span className="sr-only">Remove child</span>
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 p-4 sm:space-y-6 sm:p-6">
                    {/* Child Name */}
                    <NameFields
                      control={form.control}
                      firstNameField={`children.${index}.firstName`}
                      lastNameField={`children.${index}.lastName`}
                      firstNamePlaceholder="Enter child's first name"
                      lastNamePlaceholder="Enter child's last name"
                    />

                    {/* Date of Birth */}
                    <DateOfBirthField
                      control={form.control}
                      fieldName={`children.${index}.dateOfBirth`}
                      onValueChange={(dateValue) => {
                        form.setValue(
                          `children.${index}.dateOfBirth`,
                          dateValue as Date
                        )
                      }}
                    />

                    {/* Education Level and Grade */}
                    <EducationFields
                      control={form.control}
                      educationLevelField={`children.${index}.educationLevel`}
                      gradeLevelField={`children.${index}.gradeLevel`}
                      educationOptions={DUGSI_EDUCATION_OPTIONS}
                      gradeOptions={DUGSI_GRADE_OPTIONS}
                      educationLabel="School Level"
                      gradeLabel="Grade"
                      educationPlaceholder="Select level"
                      gradePlaceholder="Select grade"
                      onEducationChange={(value) => {
                        form.setValue(
                          `children.${index}.educationLevel`,
                          value as (typeof DUGSI_EDUCATION_OPTIONS)[number]['value']
                        )
                      }}
                      onGradeChange={(value) => {
                        form.setValue(
                          `children.${index}.gradeLevel`,
                          value as (typeof DUGSI_GRADE_OPTIONS)[number]['value']
                        )
                      }}
                    />

                    {/* School Name */}
                    <FormFieldWrapper
                      control={form.control}
                      name={`children.${index}.schoolName`}
                      label="School"
                      required
                    >
                      {(field, fieldState) => (
                        <SchoolCombobox
                          value={field.value}
                          onChange={(value) => {
                            form.setValue(`children.${index}.schoolName`, value)
                            field.onChange(value)
                          }}
                          onBlur={field.onBlur}
                          placeholder="Select school..."
                          className={getInputClassNames(!!fieldState.error)}
                        />
                      )}
                    </FormFieldWrapper>

                    {/* Health Information */}
                    <FormFieldWrapper
                      control={form.control}
                      name={`children.${index}.healthInfo`}
                      label="Health & Support Information"
                      required
                    >
                      {(field, fieldState) => (
                        <div className="space-y-2">
                          <p className="text-xs leading-relaxed text-gray-600 sm:text-sm">
                            Share any allergies, medical conditions,
                            ADHD/Autism, medications, dietary needs, or support
                            strategies. Type "None" if not applicable.
                          </p>
                          <Textarea
                            {...field}
                            placeholder="Example: Peanut allergy (EpiPen in backpack), ADHD (takes medication at home), or 'None'"
                            rows={4}
                            aria-invalid={!!fieldState.error}
                            className={cn(
                              getInputClassNames(!!fieldState.error),
                              'text-sm'
                            )}
                          />
                        </div>
                      )}
                    </FormFieldWrapper>
                  </CardContent>
                </Card>
              ))}

              {/* Add Child Button */}
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-11 w-full rounded-full border-2 border-[#007078] bg-[#007078]/5 text-sm font-semibold text-[#007078] transition-colors hover:bg-[#007078]/15 sm:h-12 sm:text-base"
                onClick={handleAddChild}
              >
                <UserPlus className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                Add Another Child
              </Button>

              {/* Submit Button */}
              <Button
                type="submit"
                className={cn(
                  buttonClassNames.primary,
                  'mt-4 h-11 text-sm sm:mt-6 sm:h-12 sm:text-base'
                )}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin sm:h-5 sm:w-5" />
                    <span className="xs:inline hidden">Processing...</span>
                    <span className="xs:hidden">Processing...</span>
                  </>
                ) : (
                  <>
                    <span className="hidden sm:inline">
                      Continue to Payment ({fields.length}{' '}
                      {fields.length === 1 ? 'child' : 'children'})
                    </span>
                    <span className="sm:hidden">
                      Continue ({fields.length})
                    </span>
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </form>
      </Form>

      {/* Payment Success Dialog */}
      <PaymentSuccessDialog
        isOpen={showPaymentDialog}
        onOpenChange={setShowPaymentDialog}
        studentCount={studentCount}
      />
    </>
  )
}
