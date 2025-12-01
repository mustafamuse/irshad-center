'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { UserPlus, X, Users, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useFieldArray, useForm } from 'react-hook-form'

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
import { Checkbox } from '@/components/ui/checkbox'
import { Form } from '@/components/ui/form'
import { GenderRadioGroup } from '@/components/ui/gender-radio-group'
import { Label } from '@/components/ui/label'
import { SchoolCombobox } from '@/components/ui/school-combobox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  useTranslatedGenderOptions,
  useTranslatedGradeOptions,
} from '@/lib/i18n/use-translated-options'
import { FormFieldWrapper } from '@/lib/registration/components/FormFieldWrapper'
import {
  dugsiRegistrationSchema,
  type DugsiRegistrationValues,
  DUGSI_DEFAULT_FORM_VALUES,
  DEFAULT_CHILD_VALUES,
  DUGSI_GRADE_OPTIONS,
  SHOW_GRADE_SCHOOL,
} from '@/lib/registration/schemas/registration'
import {
  buttonClassNames,
  getInputClassNames,
} from '@/lib/registration/utils/form-utils'
import { cn } from '@/lib/utils'

import { useDugsiRegistration } from '../_hooks/use-registration'

export function DugsiRegisterForm() {
  const t = useTranslations('dugsi')
  const genderOptions = useTranslatedGenderOptions()
  const gradeOptions = useTranslatedGradeOptions()

  const form = useForm<DugsiRegistrationValues>({
    resolver: zodResolver(dugsiRegistrationSchema),
    defaultValues: DUGSI_DEFAULT_FORM_VALUES,
    mode: 'onBlur',
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'children',
  })

  // Watch isSingleParent to show/hide parent 2 fields
  const isSingleParent = form.watch('isSingleParent')

  // Custom hook for registration logic
  const { registerChildren, isPending } = useDugsiRegistration({
    form,
  })

  const onSubmit = async (data: DugsiRegistrationValues) => {
    await registerChildren(data)
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
    <section className="flex flex-col">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-6 sm:space-y-8"
        >
          {/* Parent/Guardian Information Section */}
          <Card className="rounded-xl border-0 bg-white shadow-sm ring-1 ring-gray-200 sm:rounded-2xl">
            <CardHeader className="space-y-2 border-b p-4 sm:p-6">
              <CardTitle className="text-xl font-semibold text-[#007078] sm:text-2xl">
                {t('parentSection.title')}
              </CardTitle>
              <CardDescription className="text-sm text-gray-600 sm:text-base">
                {t('parentSection.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-4 sm:space-y-8 sm:p-6">
              {/* Parent/Guardian 1 */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-[#007078] sm:h-5 sm:w-5" />
                  <h3 className="text-base font-semibold text-[#007078] sm:text-lg">
                    {t('parentSection.parent1')}
                  </h3>
                </div>
                <NameFields
                  control={form.control}
                  firstNameField="parent1FirstName"
                  lastNameField="parent1LastName"
                  firstNameLabel={t('fields.firstName')}
                  lastNameLabel={t('fields.lastName')}
                  firstNamePlaceholder={t('placeholders.firstName')}
                  lastNamePlaceholder={t('placeholders.lastName')}
                />

                <ContactFields
                  control={form.control}
                  emailField="parent1Email"
                  phoneField="parent1Phone"
                  emailLabel={t('fields.email')}
                  phoneLabel={t('fields.phone')}
                  emailPlaceholder={t('placeholders.email')}
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
                  {t('parentSection.singleParent')}
                </Label>
              </div>

              {/* Parent/Guardian 2 - Conditional */}
              {!isSingleParent && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-[#007078] sm:h-5 sm:w-5" />
                    <h3 className="text-base font-semibold text-[#007078] sm:text-lg">
                      {t('parentSection.parent2')}
                    </h3>
                  </div>
                  <NameFields
                    control={form.control}
                    firstNameField="parent2FirstName"
                    lastNameField="parent2LastName"
                    firstNameLabel={t('fields.firstName')}
                    lastNameLabel={t('fields.lastName')}
                    firstNamePlaceholder={t('placeholders.firstName')}
                    lastNamePlaceholder={t('placeholders.lastName')}
                    required={!isSingleParent}
                  />

                  <ContactFields
                    control={form.control}
                    emailField="parent2Email"
                    phoneField="parent2Phone"
                    emailLabel={t('fields.email')}
                    phoneLabel={t('fields.phone')}
                    emailPlaceholder={t('placeholders.email')}
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
                    {t('childrenSection.title')}
                  </CardTitle>
                  <CardDescription className="mt-1 text-sm text-gray-600 sm:mt-2 sm:text-base">
                    {t('childrenSection.description')}
                  </CardDescription>
                </div>
                <div className="self-start rounded-full bg-[#007078]/10 px-3 py-1.5 sm:px-4 sm:py-2">
                  <span className="whitespace-nowrap text-xs font-medium text-[#007078] sm:text-sm">
                    {fields.length}{' '}
                    {fields.length === 1
                      ? t('childrenSection.child')
                      : t('childrenSection.children')}
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
                        {t('childrenSection.childNumber', {
                          number: index + 1,
                        })}
                      </CardTitle>
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleRemoveChild(index)}
                          className="flex h-auto flex-col items-center gap-1 border-red-200 bg-red-50 px-3 py-2 text-red-600 hover:bg-red-100 hover:text-red-700 sm:h-12 sm:w-12 sm:flex-row sm:gap-0 sm:rounded-full sm:p-0"
                        >
                          <X className="h-5 w-5" />
                          <span className="text-xs font-medium sm:sr-only">
                            {t('buttons.remove')}
                          </span>
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
                      firstNameLabel={t('fields.firstName')}
                      lastNameLabel={t('fields.lastName')}
                      firstNamePlaceholder={t('placeholders.childFirstName')}
                      lastNamePlaceholder={t('placeholders.childLastName')}
                    />

                    {/* Gender Selection */}
                    <FormFieldWrapper
                      name={`children.${index}.gender`}
                      control={form.control}
                      label={t('fields.gender')}
                      required
                    >
                      {(field) => (
                        <GenderRadioGroup
                          value={field.value}
                          onValueChange={field.onChange}
                          name={`children.${index}.gender`}
                          options={genderOptions}
                          helperText={
                            !field.value
                              ? t('helpText.genderSelect')
                              : undefined
                          }
                        />
                      )}
                    </FormFieldWrapper>

                    {/* Date of Birth */}
                    <DateOfBirthField
                      control={form.control}
                      fieldName={`children.${index}.dateOfBirth`}
                      label={t('fields.dateOfBirth')}
                      onValueChange={(dateValue) => {
                        form.setValue(
                          `children.${index}.dateOfBirth`,
                          dateValue as Date
                        )
                      }}
                    />

                    {/* Grade & School Fields - controlled by SHOW_GRADE_SCHOOL feature flag */}
                    {SHOW_GRADE_SCHOOL && (
                      <>
                        <FormFieldWrapper
                          control={form.control}
                          name={`children.${index}.gradeLevel`}
                          label={t('fields.grade')}
                          required
                        >
                          {(field, fieldState) => (
                            <Select
                              value={field.value || ''}
                              onValueChange={(value) => {
                                field.onChange(value)
                                form.setValue(
                                  `children.${index}.gradeLevel`,
                                  value as (typeof DUGSI_GRADE_OPTIONS)[number]['value']
                                )
                              }}
                            >
                              <SelectTrigger
                                aria-invalid={!!fieldState.error}
                                className={getInputClassNames(
                                  !!fieldState.error
                                )}
                              >
                                <SelectValue
                                  placeholder={t('placeholders.selectGrade')}
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {gradeOptions.map((option) => (
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
                          name={`children.${index}.schoolName`}
                          label={t('fields.school')}
                          required
                        >
                          {(field, fieldState) => (
                            <SchoolCombobox
                              value={field.value}
                              onChange={(value) => {
                                form.setValue(
                                  `children.${index}.schoolName`,
                                  value
                                )
                                field.onChange(value)
                              }}
                              onBlur={field.onBlur}
                              placeholder={t('placeholders.selectSchool')}
                              className={getInputClassNames(!!fieldState.error)}
                            />
                          )}
                        </FormFieldWrapper>
                      </>
                    )}

                    {/* Health Information */}
                    <FormFieldWrapper
                      control={form.control}
                      name={`children.${index}.healthInfo`}
                      label={t('fields.healthInfo')}
                      required
                    >
                      {(field, fieldState) => (
                        <div className="space-y-2">
                          <p className="text-xs leading-relaxed text-gray-600 sm:text-sm">
                            {t('helpText.healthInfo')}
                          </p>
                          <Textarea
                            {...field}
                            placeholder={t('placeholders.healthInfo')}
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
                {t('buttons.addChild')}
              </Button>
            </CardContent>
          </Card>

          {/* Payment Responsibility Section - Only for two-parent households */}
          {!isSingleParent && (
            <Card className="rounded-xl border-0 bg-white shadow-sm ring-1 ring-gray-200 sm:rounded-2xl">
              <CardHeader className="space-y-2 border-b p-4 sm:p-6">
                <CardTitle className="text-xl font-semibold text-[#007078] sm:text-2xl">
                  {t('parentSection.whoPays')}
                </CardTitle>
                <CardDescription className="text-sm text-gray-600 sm:text-base">
                  Select which parent will be responsible for tuition payments
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-4 sm:p-6">
                <FormFieldWrapper
                  control={form.control}
                  name="primaryPayer"
                  label={t('parentSection.whoPays')}
                  required
                >
                  {(field, fieldState) => {
                    const parent1FullName =
                      [
                        form.watch('parent1FirstName'),
                        form.watch('parent1LastName'),
                      ]
                        .filter(Boolean)
                        .join(' ')
                        .trim() || t('parentSection.parent1')

                    const parent2FullName =
                      [
                        form.watch('parent2FirstName'),
                        form.watch('parent2LastName'),
                      ]
                        .filter(Boolean)
                        .join(' ')
                        .trim() || t('parentSection.parent2')

                    return (
                      <Select
                        value={field.value || ''}
                        onValueChange={(value: 'parent1' | 'parent2') => {
                          field.onChange(value)
                          form.setValue('primaryPayer', value)
                        }}
                      >
                        <SelectTrigger
                          aria-invalid={!!fieldState.error}
                          className={getInputClassNames(!!fieldState.error)}
                        >
                          <SelectValue placeholder="Select a parent" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="parent1">
                            {parent1FullName}
                          </SelectItem>
                          <SelectItem value="parent2">
                            {parent2FullName}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    )
                  }}
                </FormFieldWrapper>
              </CardContent>
            </Card>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            className={cn(
              buttonClassNames.primary,
              'h-11 text-sm sm:h-12 sm:text-base'
            )}
            disabled={isPending}
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin sm:h-5 sm:w-5" />
                <span className="xs:inline hidden">
                  {t('buttons.processing')}
                </span>
                <span className="xs:hidden">{t('buttons.processing')}</span>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <span className="hidden sm:inline">
                  {t('buttons.continueToPayment', {
                    count: fields.length,
                    childText:
                      fields.length === 1
                        ? t('childrenSection.child')
                        : t('childrenSection.children'),
                  })}
                </span>
                <span className="sm:hidden">
                  {t('buttons.continueShort', { count: fields.length })}
                </span>
              </span>
            )}
          </Button>
        </form>
      </Form>
    </section>
  )
}
