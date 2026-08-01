'use client'

import { useState } from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useAction } from 'next-safe-action/hooks'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { DateOfBirthMonthDayYearField } from '@/components/registration/shared/DateOfBirthMonthDayYearField'
import { Button } from '@/components/ui/button'
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
  MAHAD_LOOKUP_BY_NAME_DOB_DEFAULTS,
  mahadLookupByNameAndDobSchema,
  type MahadLookupByNameAndDobValues,
} from '@/lib/registration/schemas/mahad-lookup-by-name-and-dob'
import { applySafeActionValidationErrorsToForm } from '@/lib/registration/utils/apply-safe-action-validation-to-rhf'
import { getInputClassNames } from '@/lib/registration/utils/form-utils'
import type { LookupResult } from '@/lib/services/mahad/verification-service'

import { ResultNotFoundCard } from './result-not-found-card'
import { MahadStatusView } from './shared/mahad-status-view'
import { lookupMahadByNameAndDob } from '../_actions/lookup-by-name-and-dob'

type FoundResult = Extract<LookupResult, { found: true }>

export function LookupByNameForm() {
  const [foundResult, setFoundResult] = useState<FoundResult | null>(null)
  const [notFoundIdentifier, setNotFoundIdentifier] = useState<string | null>(
    null
  )

  const form = useForm<MahadLookupByNameAndDobValues>({
    resolver: zodResolver(mahadLookupByNameAndDobSchema),
    defaultValues: MAHAD_LOOKUP_BY_NAME_DOB_DEFAULTS,
    mode: 'onBlur',
  })

  function clearNotFoundOnEdit() {
    setNotFoundIdentifier((prev) => (prev !== null ? null : prev))
  }

  const { execute, isPending } = useAction(lookupMahadByNameAndDob, {
    onSuccess: ({ data, input }) => {
      if (!data) return
      if (data.found) {
        setFoundResult(data)
        setNotFoundIdentifier(null)
        return
      }
      setFoundResult(null)
      setNotFoundIdentifier(`${input.firstName} ${input.lastName}`.trim())
    },
    onError: ({ error }) => {
      if (error.validationErrors) {
        applySafeActionValidationErrorsToForm(form, error.validationErrors)
        return
      }
      const message =
        typeof error.serverError === 'string' &&
        /too many attempts/i.test(error.serverError)
          ? error.serverError
          : 'Something went wrong. Please try again.'
      toast.error(message)
    },
  })

  const onSubmit = (data: MahadLookupByNameAndDobValues) => {
    execute(data)
  }

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                        clearNotFoundOnEdit()
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
                        clearNotFoundOnEdit()
                        field.onChange(e)
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <DateOfBirthMonthDayYearField
            control={form.control}
            fieldName="dateOfBirth"
            label="Date of birth"
            required
          />

          <Button
            type="submit"
            variant="brand"
            disabled={isPending}
            aria-busy={isPending}
            className="w-full"
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
        </form>
      </Form>

      {foundResult && (
        <MahadStatusView result={foundResult} context="verifying" />
      )}
      {notFoundIdentifier && (
        <ResultNotFoundCard
          method="name"
          attemptedIdentifier={notFoundIdentifier}
        />
      )}
    </div>
  )
}
