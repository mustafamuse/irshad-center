'use client'

import { useState } from 'react'

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
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
import { useSiblingSearch } from '@/lib/registration/hooks/use-sibling-search'
import {
  mahadRegistrationSchema as studentFormSchema,
  type MahadRegistrationValues as StudentFormValues,
  MAHAD_GRADE_OPTIONS,
  MAHAD_DEFAULT_FORM_VALUES as DEFAULT_FORM_VALUES,
  type SearchResult,
} from '@/lib/registration/schemas/registration'
import {
  buttonClassNames,
  getInputClassNames,
} from '@/lib/registration/utils/form-utils'

import { SiblingSearchDialog } from './search-dialog'
import { SiblingManagementSection } from './sibling-section'
import { PaymentSuccessDialog } from './success-dialog'
import { useRegistration } from '../_hooks/use-registration'

export function RegisterForm() {
  const [formData, setFormData] = useState<StudentFormValues | null>(null)
  const [showSiblingPrompt, setShowSiblingPrompt] = useState(false)
  const [showSiblingSearch, setShowSiblingSearch] = useState(false)
  const [showSiblingSection, setShowSiblingSection] = useState(false)
  const [siblings, setSiblings] = useState<SearchResult[]>([])
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [registeredStudentCount, setRegisteredStudentCount] = useState(1)
  const [registeredProfileId, setRegisteredProfileId] = useState('')
  const [registeredStudentName, setRegisteredStudentName] = useState('')

  // Form setup
  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentFormSchema),
    defaultValues: DEFAULT_FORM_VALUES,
    mode: 'onBlur',
  })

  // Custom hooks
  const { validateEmail, isCheckingEmail } = useEmailValidation(form)
  const { searchSiblings } = useSiblingSearch(formData?.lastName)
  const { registerStudent, isSubmitting } = useRegistration({
    form,
    onSuccess: (result) => {
      setFormData(null)
      setSiblings([])
      setShowSiblingSection(false)
      setShowSiblingPrompt(false)
      setRegisteredStudentCount(result.studentCount)
      setRegisteredProfileId(result.profileId)
      setRegisteredStudentName(result.studentName)
      setShowPaymentDialog(true)
    },
  })

  // Handlers
  const handleSubmit = async (data: StudentFormValues) => {
    // Validate email before proceeding
    const isEmailValid = await validateEmail(data.email)
    if (!isEmailValid) {
      return
    }

    setFormData(data)
    setShowSiblingPrompt(true)
  }

  const handleNoSiblingsRegistration = () => {
    if (!formData) return
    registerStudent(formData, [])
  }

  const handleSiblingRegistration = () => {
    if (!formData) return
    registerStudent(formData, siblings)
  }

  const handleAddSibling = (sibling: SearchResult) => {
    setSiblings((prev) => [...prev, sibling])
    setShowSiblingSearch(false)
  }

  const handleRemoveSibling = (siblingId: string) => {
    setSiblings((prev) => prev.filter((s) => s.id !== siblingId))
  }

  const handleSiblingSearchOpen = () => {
    setShowSiblingSearch(true)
  }

  return (
    <div className="min-h-screen bg-white px-4 pb-20 pt-4 md:px-6 md:py-8">
      <div className="mx-auto max-w-3xl space-y-4 md:space-y-8">
        {/* Navigation Context */}
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
                {/* Name Fields */}
                <NameFields
                  control={form.control}
                  firstNameField="firstName"
                  lastNameField="lastName"
                  firstNameLabel="Legal First Name"
                  lastNameLabel="Legal Last Name"
                  firstNamePlaceholder="Enter your legal first name"
                  lastNamePlaceholder="Enter your legal last name"
                />

                {/* Contact Fields */}
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

                {/* Date of Birth Field */}
                <DateOfBirthField
                  control={form.control}
                  fieldName="dateOfBirth"
                />

                {/* Grade Level Field */}
                <FormFieldWrapper
                  control={form.control}
                  name="gradeLevel"
                  label="Grade Level (Optional)"
                  required={false}
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
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </FormFieldWrapper>

                {/* School Name Field */}
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

                {/* Submit Button */}
                <Button
                  type="submit"
                  className={buttonClassNames.primary}
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Submitting...
                    </span>
                  ) : (
                    'Continue to Next Step'
                  )}
                </Button>
              </CardContent>
            </Card>
          </form>
        </Form>

        {/* Sibling Management Section */}
        {showSiblingSection && (
          <SiblingManagementSection
            siblings={siblings}
            onRemoveSibling={handleRemoveSibling}
            onAddSiblingClick={handleSiblingSearchOpen}
            onContinue={handleSiblingRegistration}
            isSubmitting={isSubmitting}
          />
        )}

        {/* Sibling Dialog */}
        <Dialog open={showSiblingPrompt} onOpenChange={setShowSiblingPrompt}>
          <DialogContent className="mx-4 max-w-[400px] rounded-2xl border-0 p-6 shadow-sm md:p-8">
            <DialogHeader className="space-y-3">
              <DialogTitle className="text-center text-xl font-semibold text-[#007078]">
                Do you have any siblings at Irshād Māhad?
              </DialogTitle>
              <DialogDescription className="text-center text-base text-gray-600">
                Let us know if you have any siblings currently enrolled. This
                helps us keep family records together.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button
                className={buttonClassNames.primary}
                onClick={handleNoSiblingsRegistration}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <div className="flex flex-col gap-4 sm:gap-6">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Processing...
                  </div>
                ) : (
                  'No, Continue to Payment'
                )}
              </Button>
              <Button
                variant="outline"
                className={buttonClassNames.secondary}
                onClick={() => {
                  setShowSiblingPrompt(false)
                  setShowSiblingSection(true)
                }}
                disabled={isSubmitting}
              >
                Yes, Add a Sibling
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Sibling Search Dialog */}
        <SiblingSearchDialog
          isOpen={showSiblingSearch}
          onOpenChange={setShowSiblingSearch}
          onAddSibling={handleAddSibling}
          onSearch={searchSiblings}
          studentLastName={formData?.lastName}
          existingSiblingIds={siblings.map((s) => s.id)}
        />

        {/* Payment Success Dialog */}
        <PaymentSuccessDialog
          isOpen={showPaymentDialog}
          onOpenChange={setShowPaymentDialog}
          studentCount={registeredStudentCount}
          profileId={registeredProfileId}
          studentName={registeredStudentName}
        />
      </div>
    </div>
  )
}
