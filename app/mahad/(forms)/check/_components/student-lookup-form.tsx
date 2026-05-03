'use client'

import { useState } from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
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
import {
  mahadStudentLookupSchema,
  type MahadStudentLookupValues,
} from '@/lib/registration/schemas/mahad-student-lookup'
import { applySafeActionValidationErrorsToForm } from '@/lib/registration/utils/apply-safe-action-validation-to-rhf'
import { getInputClassNames } from '@/lib/registration/utils/form-utils'

import { LookupFoundCard } from './lookup-found-card'
import { LookupNotFoundCard } from './lookup-not-found-card'
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
      if (!data || data.found === false) {
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
              <CardTitle className="text-xl font-semibold text-brand">
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

      {lookupResult.status === 'not_found' && <LookupNotFoundCard />}
      {lookupResult.status === 'found' && (
        <LookupFoundCard
          registeredAt={lookupResult.registeredAt}
          programStatusLabel={lookupResult.programStatusLabel}
        />
      )}
    </div>
  )
}
