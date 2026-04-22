'use client'

import { useState } from 'react'

import Link from 'next/link'

import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { useAction } from 'next-safe-action/hooks'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
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
import { applySafeActionValidationErrorsToForm } from '@/lib/mahad/apply-safe-action-validation-to-rhf'
import {
  mahadStudentLookupSchema,
  type MahadStudentLookupValues,
} from '@/lib/mahad/student-lookup-schema'
import { getInputClassNames } from '@/lib/registration/utils/form-utils'

import { lookupMahadRegistration } from '../_actions/lookup'

type LookupUiState =
  | { status: 'idle' }
  | { status: 'not_found' }
  | {
      status: 'found'
      registeredAt: string
      programStatusLabel: string
    }

export function StudentLookupForm() {
  const [lookupResult, setLookupResult] = useState<LookupUiState>({
    status: 'idle',
  })

  const form = useForm<MahadStudentLookupValues>({
    resolver: zodResolver(mahadStudentLookupSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      phoneLast4: '',
    },
    mode: 'onBlur',
  })

  function clearLookupCardOnEdit() {
    setLookupResult((prev) =>
      prev.status === 'idle' ? prev : { status: 'idle' }
    )
  }

  const { execute, isPending } = useAction(lookupMahadRegistration, {
    onSuccess: ({ data }) => {
      if (!data?.found) {
        setLookupResult({ status: 'not_found' })
        return
      }
      setLookupResult({
        status: 'found',
        registeredAt: data.registeredAt,
        programStatusLabel: data.programStatusLabel,
      })
    },
    onError: ({ error }) => {
      if (error.validationErrors) {
        applySafeActionValidationErrorsToForm(form, error.validationErrors)
      }
      if (error.serverError) {
        toast.error(error.serverError)
      }
      setLookupResult({ status: 'idle' })
    },
  })

  const onSubmit = (data: MahadStudentLookupValues) => {
    setLookupResult({ status: 'idle' })
    execute(data)
  }

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
                Use the{' '}
                <span className="font-medium">legal first and last name</span>{' '}
                you registered with, and the{' '}
                <span className="font-medium">last 4 digits</span> of the phone
                number on your registration (WhatsApp number).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 px-0">
              <div className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel className="text-base font-medium">
                        Legal first name
                        <span aria-hidden="true" className="text-destructive">
                          {' '}
                          *
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          autoComplete="given-name"
                          placeholder="First name"
                          aria-required="true"
                          aria-invalid={!!fieldState.error}
                          disabled={isPending}
                          className={getInputClassNames(!!fieldState.error)}
                          onChange={(e) => {
                            clearLookupCardOnEdit()
                            field.onChange(e)
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel className="text-base font-medium">
                        Legal last name
                        <span aria-hidden="true" className="text-destructive">
                          {' '}
                          *
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          autoComplete="family-name"
                          placeholder="Last name"
                          aria-required="true"
                          aria-invalid={!!fieldState.error}
                          disabled={isPending}
                          className={getInputClassNames(!!fieldState.error)}
                          onChange={(e) => {
                            clearLookupCardOnEdit()
                            field.onChange(e)
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="phoneLast4"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel className="text-base font-medium">
                        Last 4 digits of phone
                        <span aria-hidden="true" className="text-destructive">
                          {' '}
                          *
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          inputMode="numeric"
                          pattern="\d{4}"
                          autoComplete="off"
                          placeholder="1234"
                          maxLength={4}
                          aria-required="true"
                          aria-invalid={!!fieldState.error}
                          disabled={isPending}
                          className={getInputClassNames(!!fieldState.error)}
                          onChange={(e) => {
                            clearLookupCardOnEdit()
                            const v = e.target.value
                              .replace(/\D/g, '')
                              .slice(0, 4)
                            field.onChange(v)
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="hidden md:block" aria-hidden="true" />
              </div>

              <Button
                type="submit"
                variant="brand"
                disabled={isPending}
                aria-busy={isPending}
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
        <Alert
          variant="warning"
          role="status"
          aria-live="polite"
          className="rounded-2xl p-6 md:p-8"
        >
          <AlertCircle className="h-5 w-5" />
          <AlertTitle className="text-base font-semibold">
            No registration found
          </AlertTitle>
          <AlertDescription className="mt-1 space-y-4">
            <p>
              We could not find a Māhad registration matching those details.
              Double-check the name and phone number you used when registering.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild variant="brand">
                <Link href="/mahad/register">Register for Māhad</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-14 rounded-full border-amber-300 text-amber-800 hover:bg-amber-100 md:h-12"
              >
                <Link href="/mahad">Back to home</Link>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {lookupResult.status === 'found' && (
        <Alert
          variant="success"
          role="status"
          aria-live="polite"
          className="overflow-hidden rounded-2xl p-0"
        >
          <div className="p-6 md:p-8">
            <div className="flex gap-4">
              <CheckCircle2
                className="mt-0.5 h-5 w-5 shrink-0"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1 space-y-4">
                <div>
                  <AlertTitle className="text-base font-semibold">
                    Registration on file
                  </AlertTitle>
                  <AlertDescription className="mt-1 text-sm text-gray-600">
                    A Māhad registration was found matching your details.
                  </AlertDescription>
                </div>
                <dl className="space-y-1.5 text-sm">
                  <div className="flex items-center gap-2">
                    <dt className="font-medium text-gray-700">Submitted</dt>
                    <dd className="text-gray-600">
                      {new Intl.DateTimeFormat('en-US', {
                        timeZone: 'UTC',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      }).format(new Date(lookupResult.registeredAt))}
                    </dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <dt className="font-medium text-gray-700">Status</dt>
                    <dd>
                      <Badge
                        variant="outline"
                        className="border-[#007078]/30 bg-[#007078]/10 text-[#007078]"
                      >
                        {lookupResult.programStatusLabel}
                      </Badge>
                    </dd>
                  </div>
                </dl>
                <p className="text-xs text-gray-400">
                  If something looks wrong, contact the admin team with your
                  full name and phone number.
                </p>
              </div>
            </div>
          </div>
          <div
            className="h-1 w-full"
            style={{
              background: 'linear-gradient(90deg, #007078 0%, #deb43e 100%)',
            }}
            aria-hidden="true"
          />
        </Alert>
      )}
    </div>
  )
}
