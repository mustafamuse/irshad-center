'use client'

import { useCallback, useState, useTransition } from 'react'

import Link from 'next/link'

import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { Loader2 } from 'lucide-react'
import { FieldPath, useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { createClientLogger } from '@/lib/logger-client'
import {
  mahadStudentLookupSchema,
  type MahadStudentLookupValues,
} from '@/lib/mahad/student-lookup-schema'
import {
  buttonClassNames,
  getInputClassNames,
} from '@/lib/registration/utils/form-utils'

import { lookupMahadRegistration } from '../_actions/lookup'

const logger = createClientLogger('mahad-student-lookup')

export function StudentLookupForm() {
  const [isPending, startTransition] = useTransition()
  const [lookupResult, setLookupResult] = useState<
    | { status: 'idle' }
    | { status: 'not_found' }
    | {
        status: 'found'
        studentName: string
        registeredAt: string
        programStatusLabel: string
        enrollmentStatusLabel: string | null
      }
  >({ status: 'idle' })

  const form = useForm<MahadStudentLookupValues>({
    resolver: zodResolver(mahadStudentLookupSchema),
    defaultValues: {
      lastName: '',
      phoneLast4: '',
    },
    mode: 'onBlur',
  })

  const onSubmit = useCallback(
    (data: MahadStudentLookupValues) => {
      setLookupResult({ status: 'idle' })
      startTransition(async () => {
        try {
          const result = await lookupMahadRegistration(data)

          if (result?.validationErrors) {
            for (const [field, fieldErrors] of Object.entries(
              result.validationErrors
            )) {
              const errors = fieldErrors as { _errors?: string[] }
              if (errors._errors?.[0]) {
                form.setError(field as FieldPath<MahadStudentLookupValues>, {
                  type: 'manual',
                  message: errors._errors[0],
                })
              }
            }
            setLookupResult({ status: 'idle' })
            return
          }

          if (result?.serverError) {
            toast.error(result.serverError)
            setLookupResult({ status: 'idle' })
            return
          }

          const payload = result?.data
          if (!payload) {
            setLookupResult({ status: 'idle' })
            return
          }

          if (!payload.found) {
            setLookupResult({ status: 'not_found' })
            return
          }

          setLookupResult({
            status: 'found',
            studentName: payload.studentName,
            registeredAt: payload.registeredAt,
            programStatusLabel: payload.programStatusLabel,
            enrollmentStatusLabel: payload.enrollmentStatusLabel,
          })
        } catch (e) {
          logger.error('Lookup error', e)
          toast.error('Something went wrong. Please try again.')
          setLookupResult({ status: 'idle' })
        }
      })
    },
    [form]
  )

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card className="overflow-hidden rounded-2xl border-0 bg-white p-6 shadow-sm ring-1 ring-gray-200 md:p-8">
            <CardHeader className="space-y-1 px-0 pb-6">
              <CardTitle className="text-xl font-semibold text-[#007078]">
                Look up your registration
              </CardTitle>
              <CardDescription className="text-gray-600">
                Use the <span className="font-medium">legal last name</span> you
                registered with and the{' '}
                <span className="font-medium">last 4 digits</span> of the phone
                number on your registration (WhatsApp number).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 px-0">
              <FormField
                control={form.control}
                name="lastName"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel className="text-base font-medium">
                      Legal last name
                      <span className="text-destructive"> *</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        autoComplete="family-name"
                        placeholder="Last name"
                        aria-invalid={!!fieldState.error}
                        className={getInputClassNames(!!fieldState.error)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phoneLast4"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel className="text-base font-medium">
                      Last 4 digits of phone
                      <span className="text-destructive"> *</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="1234"
                        maxLength={4}
                        aria-invalid={!!fieldState.error}
                        className={getInputClassNames(!!fieldState.error)}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, '').slice(0, 4)
                          field.onChange(v)
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className={buttonClassNames.primary}
                disabled={isPending}
              >
                {isPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Checking…
                  </span>
                ) : (
                  'Check registration'
                )}
              </Button>
            </CardContent>
          </Card>
        </form>
      </Form>

      {lookupResult.status === 'not_found' && (
        <Card className="overflow-hidden rounded-2xl border-0 bg-white p-6 shadow-sm ring-1 ring-amber-200 md:p-8">
          <CardHeader className="px-0 pb-2">
            <CardTitle className="text-lg text-[#007078]">
              No registration found
            </CardTitle>
            <CardDescription>
              We could not find a Mahad registration that matches those details.
              If you have not registered yet, use the link below.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 px-0 pt-2">
            <Button asChild className={buttonClassNames.primary}>
              <Link href="/mahad/register">Register for Māhad</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/mahad">Back to Mahad home</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {lookupResult.status === 'found' && (
        <Card className="overflow-hidden rounded-2xl border-0 bg-white p-6 shadow-sm ring-1 ring-teal-200 md:p-8">
          <CardHeader className="px-0 pb-2">
            <CardTitle className="text-lg text-[#007078]">
              Registration on file
            </CardTitle>
            <CardDescription>
              We found a Mahad registration for{' '}
              <span className="font-medium text-foreground">
                {lookupResult.studentName}
              </span>
              .
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 px-0 text-sm text-gray-700">
            <p>
              <span className="font-medium text-gray-900">Submitted: </span>
              {format(new Date(lookupResult.registeredAt), 'MMMM d, yyyy')}
            </p>
            <p>
              <span className="font-medium text-gray-900">Program status: </span>
              {lookupResult.programStatusLabel}
            </p>
            {lookupResult.enrollmentStatusLabel && (
              <p>
                <span className="font-medium text-gray-900">
                  Enrollment status:{' '}
                </span>
                {lookupResult.enrollmentStatusLabel}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              If something looks wrong, contact the admin team with your full
              name and phone number.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
