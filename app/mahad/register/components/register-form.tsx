'use client'

import { useState, useEffect, useCallback } from 'react'

import Link from 'next/link'

import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarDate } from '@internationalized/date'
import { EducationLevel, GradeLevel } from '@prisma/client'
import { AlertTriangle, UserPlus, X, Check, Loader2, Home } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { DateField, DateInput } from '@/components/ui/date-field'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getRegistrationStudents,
  registerWithSiblings,
} from '@/lib/actions/register'
import { cn } from '@/lib/utils'

import { PaymentSuccessDialog } from './payment-success-dialog'
import { studentFormSchema, type StudentFormValues } from '../schema'

// Phone number formatting function
function formatPhoneNumber(value: string): string {
  const cleaned = value.replace(/\D/g, '')
  return cleaned.length === 10
    ? cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')
    : cleaned
}

interface SearchResult {
  id: string
  name: string
  lastName: string
}

const GRADE_LEVEL_LABELS: Record<GradeLevel, string> = {
  FRESHMAN: 'Freshman',
  SOPHOMORE: 'Sophomore',
  JUNIOR: 'Junior',
  SENIOR: 'Senior',
}

// Add debounce utility
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

export function RegisterForm() {
  const [formData, setFormData] = useState<StudentFormValues | null>(null)
  const [showSiblingPrompt, setShowSiblingPrompt] = useState(false)
  const [showSiblingSearch, setShowSiblingSearch] = useState(false)
  const [showSiblingSection, setShowSiblingSection] = useState(false)
  const [siblings, setSiblings] = useState<SearchResult[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [selectedStudent, setSelectedStudent] = useState<SearchResult | null>(
    null
  )
  const [isCheckingEmail, setIsCheckingEmail] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [registeredStudentCount, setRegisteredStudentCount] = useState(1)

  // Debounced search function
  const debouncedSearch = debounce(async (query: string) => {
    if (query.length >= 2) {
      await searchSiblings(query)
    } else {
      setSearchResults([])
    }
  }, 300)

  // Search function using actual API
  const searchSiblings = async (query: string) => {
    if (!formData?.lastName) {
      toast.error('Complete your details first', {
        description:
          'Please fill in your personal information before searching for siblings',
      })
      return
    }

    if (query.trim().length < 2) {
      setSearchResults([])
      return
    }

    try {
      const students = await getRegistrationStudents()

      // Enhanced filtering
      const results = students
        .filter((student) => {
          const studentLastName = student.name
            .split(' ')
            .slice(-1)[0]
            .toLowerCase()
          const searchLastName = formData.lastName.toLowerCase()
          const searchQuery = query.toLowerCase()

          return (
            studentLastName === searchLastName && // Exact last name match
            student.name.toLowerCase().includes(searchQuery) && // Name contains search query
            !siblings.some((sib) => sib.id === student.id) // Not already added
          )
        })
        .map((student) => ({
          id: student.id,
          name: student.name,
          lastName: student.name.split(' ').slice(-1)[0],
        }))

      setSearchResults(results)

      // Only show "no results" message in the UI, not as a toast
    } catch (error) {
      console.error('Error searching siblings:', error)
      toast.error('Unable to search for siblings', {
        description:
          'Please try again or contact support if the issue persists',
      })
      setSearchResults([])
    }
  }

  // Add sibling handler with improved toast feedback
  const handleAddSelectedSibling = () => {
    if (selectedStudent) {
      setSiblings((prev) => [...prev, selectedStudent])
      setSelectedStudent(null)
      setSearchResults([])
      setSearchTerm('')
      setShowSiblingSearch(false)
    }
  }

  // Form setup with proper typing
  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      dateOfBirth: undefined,
      educationLevel: undefined,
      gradeLevel: null,
      schoolName: '',
    },
  })

  // Add email validation on blur
  const validateEmail = async (email: string) => {
    if (!email) return true

    setIsCheckingEmail(true)
    try {
      const students = await getRegistrationStudents()
      const exists = students.some((student) => student.email === email)

      if (exists) {
        form.setError('email', {
          type: 'manual',
          message: 'This email is already registered',
        })
        return false
      }

      form.clearErrors('email')
      return true
    } catch (error) {
      console.error('Error checking email:', error)
      return true // Allow submission on error, we'll catch it server-side
    } finally {
      setIsCheckingEmail(false)
    }
  }

  const handleSubmit = async (data: StudentFormValues) => {
    // Validate email before proceeding
    const isEmailValid = await validateEmail(data.email)
    if (!isEmailValid) {
      toast.error('This email is already registered', {
        description: 'Please use a different email address',
      })
      return
    }

    setFormData(data)
    setShowSiblingPrompt(true)
  }

  // Handle registration for students with no siblings
  const handleNoSiblingsRegistration = useCallback(async () => {
    if (!formData || isSubmitting) return
    setIsSubmitting(true)

    const registrationPromise = registerWithSiblings({
      studentData: formData,
      siblingIds: null,
    })

    try {
      await toast.promise(registrationPromise, {
        loading: 'Processing your registration...',
        success: 'Registration complete! Redirecting to payment...',
        error: 'Registration failed. Please try again.',
      })

      const result = await registrationPromise

      if (result) {
        form.reset()
        setFormData(null)
        setShowSiblingPrompt(false)
        // Show payment dialog for single student
        setRegisteredStudentCount(1)
        setShowPaymentDialog(true)
      }
    } catch (error) {
      console.error('Registration error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }, [formData, isSubmitting, form])

  // Handle registration for students with siblings
  const handleSiblingRegistration = useCallback(async () => {
    if (!formData || isSubmitting) return
    setIsSubmitting(true)

    const loadingMessage =
      siblings.length > 0
        ? `Registering you with ${siblings.length} sibling${siblings.length > 1 ? 's' : ''}...`
        : 'Processing your registration...'

    const successMessage =
      siblings.length > 0
        ? `Registration complete! Redirecting to payment for ${siblings.length + 1} students...`
        : 'Registration complete! Redirecting to payment...'

    const registrationPromise = registerWithSiblings({
      studentData: formData,
      siblingIds: siblings.map((s) => s.id),
    })

    try {
      await toast.promise(registrationPromise, {
        loading: loadingMessage,
        success: successMessage,
        error: 'Registration failed. Please try again.',
      })

      const result = await registrationPromise

      if (result) {
        form.reset()
        setFormData(null)
        setSiblings([])
        setShowSiblingSection(false)
        // Show payment dialog with sibling count
        setRegisteredStudentCount(siblings.length + 1)
        setShowPaymentDialog(true)
      }
    } catch (error) {
      console.error('Registration error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }, [formData, isSubmitting, siblings, form])

  // Effect to handle state updates after registration
  useEffect(() => {
    return () => {
      // Cleanup any pending state updates
      setIsSubmitting(false)
    }
  }, [])

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
                {/* Name Fields - Adjust spacing and sizing */}
                <div className="grid gap-5 md:grid-cols-2 md:gap-6">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field, fieldState }) => (
                      <FormItem className="space-y-2.5">
                        <FormLabel className="text-base font-medium">
                          Legal First Name{' '}
                          <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter your legal first name"
                            {...field}
                            value={field.value || ''}
                            aria-invalid={!!fieldState.error}
                            className={cn(
                              'h-14 rounded-lg px-4 text-base md:h-12',
                              fieldState.error &&
                                'border-destructive focus-visible:ring-destructive'
                            )}
                          />
                        </FormControl>
                        <FormMessage className="text-sm" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field, fieldState }) => (
                      <FormItem className="space-y-2.5">
                        <FormLabel className="text-base font-medium">
                          Legal Last Name{' '}
                          <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter your legal last name"
                            {...field}
                            value={field.value || ''}
                            aria-invalid={!!fieldState.error}
                            className={cn(
                              'h-14 rounded-lg px-4 text-base md:h-12',
                              fieldState.error &&
                                'border-destructive focus-visible:ring-destructive'
                            )}
                          />
                        </FormControl>
                        <FormMessage className="text-sm" />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Contact Fields - Improve touch targets */}
                <div className="grid gap-5 md:grid-cols-2 md:gap-6">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field, fieldState }) => (
                      <FormItem className="space-y-2.5">
                        <FormLabel className="text-base font-medium">
                          Email <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type="email"
                              placeholder="Enter your email"
                              {...field}
                              value={field.value || ''}
                              onBlur={async (e) => {
                                field.onBlur()
                                await validateEmail(e.target.value)
                              }}
                              aria-invalid={!!fieldState.error}
                              className={cn(
                                'h-14 rounded-lg px-4 text-base md:h-12',
                                fieldState.error &&
                                  'border-destructive focus-visible:ring-destructive',
                                isCheckingEmail && 'pr-12'
                              )}
                            />
                            {isCheckingEmail && (
                              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                              </div>
                            )}
                          </div>
                        </FormControl>
                        <FormMessage className="text-sm" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field, fieldState }) => (
                      <FormItem className="space-y-2.5">
                        <FormLabel className="text-base font-medium">
                          Phone <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="XXX-XXX-XXXX"
                            type="tel"
                            {...field}
                            value={field.value || ''}
                            onChange={(e) => {
                              const formatted = formatPhoneNumber(
                                e.target.value
                              )
                              field.onChange(formatted)
                            }}
                            aria-invalid={!!fieldState.error}
                            className={cn(
                              'h-14 rounded-lg px-4 text-base md:h-12',
                              fieldState.error &&
                                'border-destructive focus-visible:ring-destructive'
                            )}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          Enter your whatsapp number
                        </p>
                        <FormMessage className="text-sm" />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Date of Birth Field */}
                <div className="sm:col-span-2">
                  <FormField
                    control={form.control}
                    name="dateOfBirth"
                    render={({ field, fieldState }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="text-base font-medium">
                          Date of Birth{' '}
                          <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <DateField
                            value={
                              field.value
                                ? new CalendarDate(
                                    field.value.getFullYear(),
                                    field.value.getMonth() + 1,
                                    field.value.getDate()
                                  )
                                : null
                            }
                            onChange={(date) => {
                              if (date) {
                                field.onChange(
                                  new Date(date.year, date.month - 1, date.day)
                                )
                              } else {
                                field.onChange(null)
                              }
                            }}
                            aria-invalid={!!fieldState.error}
                            aria-label="Date of Birth"
                          >
                            <DateInput />
                          </DateField>
                        </FormControl>
                        <FormMessage className="text-sm" />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Education Fields */}
                <div className="grid gap-5 md:grid-cols-2 md:gap-6">
                  <FormField
                    control={form.control}
                    name="educationLevel"
                    render={({ field, fieldState }) => (
                      <FormItem className="space-y-2.5">
                        <FormLabel className="text-base font-medium">
                          Education Level{' '}
                          <span className="text-destructive">*</span>
                        </FormLabel>
                        <Select
                          value={field.value || undefined}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger
                              aria-invalid={!!fieldState.error}
                              className={cn(
                                'h-14 rounded-lg px-4 text-base md:h-12',
                                fieldState.error &&
                                  'border-destructive focus-visible:ring-destructive'
                              )}
                            >
                              <SelectValue placeholder="Select education level" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.values(EducationLevel).map((level) => (
                              <SelectItem key={level} value={level}>
                                {level.replace('_', ' ')}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-sm" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="gradeLevel"
                    render={({ field, fieldState }) => (
                      <FormItem className="space-y-2.5">
                        <FormLabel className="text-base font-medium">
                          Grade Level{' '}
                          <span className="text-destructive">*</span>
                        </FormLabel>
                        <Select
                          value={field.value || undefined}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger
                              aria-invalid={!!fieldState.error}
                              className={cn(
                                'h-14 rounded-lg px-4 text-base md:h-12',
                                fieldState.error &&
                                  'border-destructive focus-visible:ring-destructive'
                              )}
                            >
                              <SelectValue placeholder="Select grade level" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.values(GradeLevel).map((level) => (
                              <SelectItem key={level} value={level}>
                                {GRADE_LEVEL_LABELS[level]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-sm" />
                      </FormItem>
                    )}
                  />
                </div>

                {/* School Name Field */}
                <div className="sm:col-span-2">
                  <FormField
                    control={form.control}
                    name="schoolName"
                    render={({ field, fieldState }) => (
                      <FormItem className="space-y-2.5">
                        <FormLabel className="text-base font-medium">
                          School Name{' '}
                          <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value || ''}
                            placeholder="Enter school name"
                            aria-invalid={!!fieldState.error}
                            className={cn(
                              'h-14 rounded-lg px-4 text-base md:h-12',
                              fieldState.error &&
                                'border-destructive focus-visible:ring-destructive'
                            )}
                          />
                        </FormControl>
                        <FormMessage className="text-sm" />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Buttons - Optimize for touch */}
                <Button
                  type="submit"
                  className="mt-6 h-14 w-full gap-2 rounded-full bg-[#007078] text-base font-medium text-white transition-colors hover:bg-[#007078]/90 md:h-12"
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Continue to Next Step'
                  )}
                </Button>
              </CardContent>
            </Card>
          </form>
        </Form>

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
                className="h-14 w-full rounded-full bg-[#007078] text-base font-medium text-white transition-colors hover:bg-[#007078]/90 md:h-12"
                onClick={handleNoSiblingsRegistration}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'No, Continue to Payment'
                )}
              </Button>
              <Button
                variant="outline"
                className="h-14 w-full rounded-full border-[#deb43e] text-base font-medium text-[#deb43e] transition-colors hover:bg-[#deb43e]/10 md:h-12"
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

        {/* Sibling Management Section */}
        {showSiblingSection && (
          <Card className="rounded-2xl border-0 bg-white shadow-sm ring-1 ring-gray-200">
            <CardHeader className="space-y-2 border-b p-6">
              <CardTitle className="text-2xl font-semibold text-[#007078]">
                Sibling Registration
              </CardTitle>
              <CardDescription className="text-base text-gray-600">
                Add your siblings to complete the registration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <h4 className="text-lg font-medium text-[#007078]">
                    Siblings to Add
                  </h4>
                  <p className="text-sm text-gray-600">
                    {siblings.length
                      ? `${siblings.length} sibling${siblings.length > 1 ? 's' : ''} added`
                      : 'No siblings added yet'}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="lg"
                  className="flex w-full items-center gap-2 rounded-full border-[#007078] text-[#007078] transition-colors hover:bg-[#007078]/10 sm:w-auto"
                  onClick={() => setShowSiblingSearch(true)}
                >
                  <UserPlus className="h-5 w-5" />
                  Add a Sibling
                </Button>
              </div>

              {siblings.length > 0 && (
                <div className="rounded-xl bg-[#007078]/5">
                  {siblings.map((sibling, index) => (
                    <div
                      key={sibling.id}
                      className={cn(
                        'flex items-center justify-between p-4',
                        index !== siblings.length - 1 &&
                          'border-b border-[#007078]/10'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#deb43e]/10">
                          <span className="text-sm font-medium text-[#deb43e]">
                            {sibling.name
                              .split(' ')
                              .map((n) => n[0])
                              .join('')}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <p className="font-medium text-[#007078]">
                            {sibling.name}
                          </p>
                          <p className="text-sm text-gray-600">
                            Sibling #{index + 1}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                        onClick={() => {
                          setSiblings((prev) =>
                            prev.filter((s) => s.id !== sibling.id)
                          )
                        }}
                      >
                        <X className="h-4 w-4" />
                        <span className="sr-only">Remove sibling</span>
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-4 pt-4">
                <Button
                  onClick={handleSiblingRegistration}
                  className="h-14 w-full rounded-full bg-[#007078] text-base font-medium text-white transition-colors hover:bg-[#007078]/90 md:h-12"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Continue to Payment'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sibling Search Dialog */}
        <Dialog open={showSiblingSearch} onOpenChange={setShowSiblingSearch}>
          <DialogContent className="mx-4 max-w-[425px] rounded-2xl border-0 p-6 shadow-sm md:p-8">
            <DialogHeader className="space-y-3">
              <DialogTitle className="text-xl font-semibold text-[#007078]">
                Add a Sibling
              </DialogTitle>
              <DialogDescription className="text-gray-600">
                Search for siblings with last name &quot;{formData?.lastName}
                &quot;
              </DialogDescription>
              <div className="mt-2 rounded-xl border-l-4 border-[#deb43e] bg-[#deb43e]/5 p-4">
                <div className="flex items-center justify-center gap-2 text-[#deb43e]">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm font-semibold">Important</span>
                </div>
                <div className="mt-2 text-center text-sm text-[#deb43e]">
                  <span>Please note:</span>
                  <ul className="mt-1 list-none space-y-1">
                    <li>• Only siblings with the same last name will appear</li>
                    <li>• Your sibling must be registered at Irshād Māhad</li>
                  </ul>
                </div>
              </div>
            </DialogHeader>

            <div className="mt-6 space-y-4">
              <Input
                placeholder="Search by name..."
                value={searchTerm}
                onChange={(e) => {
                  const value = e.target.value
                  setSearchTerm(value)
                  debouncedSearch(value)
                }}
                className="h-12 rounded-lg border-gray-200 text-base placeholder:text-gray-400"
              />

              <div className="max-h-[200px] overflow-y-auto rounded-xl border border-gray-200">
                {searchResults.length === 0 ? (
                  <div className="p-4 text-center">
                    <p className="text-sm font-medium text-gray-600">
                      {!formData?.lastName
                        ? 'Please complete personal details first'
                        : searchTerm.length < 2
                          ? 'Type at least 2 characters to search'
                          : 'No siblings found with the same last name'}
                    </p>
                    {searchTerm.length >= 2 && (
                      <p className="mt-1 text-xs text-gray-500">
                        Make sure your sibling is registered with the same last
                        name
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {searchResults.map((student) => (
                      <div
                        key={student.id}
                        className={cn(
                          'flex cursor-pointer items-center justify-between p-4 transition-colors',
                          selectedStudent?.id === student.id
                            ? 'bg-[#007078]/5'
                            : 'hover:bg-[#007078]/5'
                        )}
                        onClick={() => setSelectedStudent(student)}
                      >
                        <div>
                          <p className="font-medium text-[#007078]">
                            {student.name}
                          </p>
                        </div>
                        {selectedStudent?.id === student.id && (
                          <Check className="h-4 w-4 text-[#007078]" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  className="flex-1 rounded-full border-[#deb43e] text-[#deb43e] transition-colors hover:bg-[#deb43e]/10"
                  onClick={() => {
                    setShowSiblingSearch(false)
                    setSearchTerm('')
                    setSearchResults([])
                    setSelectedStudent(null)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 rounded-full bg-[#007078] text-white transition-colors hover:bg-[#007078]/90"
                  onClick={handleAddSelectedSibling}
                  disabled={!selectedStudent}
                >
                  Add Sibling
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Payment Success Dialog */}
        <PaymentSuccessDialog
          isOpen={showPaymentDialog}
          onOpenChange={setShowPaymentDialog}
          studentCount={registeredStudentCount}
        />
      </div>
    </div>
  )
}
