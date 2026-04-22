'use client'

import { useState } from 'react'

import Link from 'next/link'

import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { Loader2 } from 'lucide-react'
import { useAction } from 'next-safe-action/hooks'
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
import {
  buttonClassNames,
  getInputClassNames,
} from '@/lib/registration/utils/form-utils'

import { lookupMahadRegistration } from '../_actions/lookup'

type LookupUiState =
  | { status: 'idle' }
  | { status: 'not_found' }
  | {
      status: 'found'
      studentName: string
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
        studentName: data.studentName,
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
        <Card
          role="status"
          aria-live="polite"
          className="overflow-hidden rounded-2xl border-0 bg-white p-6 shadow-sm ring-1 ring-amber-200 md:p-8"
        >
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
        <Card
          role="status"
          aria-live="polite"
          className="overflow-hidden rounded-2xl border-0 bg-white p-6 shadow-sm ring-1 ring-teal-200 md:p-8"
        >
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
