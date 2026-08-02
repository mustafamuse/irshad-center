'use client'

import { useState } from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useAction } from 'next-safe-action/hooks'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

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
  mahadLookupByEmailSchema,
  type MahadLookupByEmailValues,
} from '@/lib/registration/schemas/mahad-lookup-by-email'
import { applySafeActionValidationErrorsToForm } from '@/lib/registration/utils/apply-safe-action-validation-to-rhf'
import { getInputClassNames } from '@/lib/registration/utils/form-utils'
import type { LookupResult } from '@/lib/services/mahad/verification-service'

import { ResultNotFoundCard } from './result-not-found-card'
import { MahadStatusView } from './shared/mahad-status-view'
import { lookupMahadByEmail } from '../_actions/lookup-by-email'

type FoundResult = Extract<LookupResult, { found: true }>

export function LookupByEmailForm() {
  const [foundResult, setFoundResult] = useState<FoundResult | null>(null)
  const [notFoundContext, setNotFoundContext] = useState<string | null>(null)

  const form = useForm<MahadLookupByEmailValues>({
    resolver: zodResolver(mahadLookupByEmailSchema),
    defaultValues: { email: '' },
    mode: 'onBlur',
  })

  function clearResultsOnEdit() {
    setNotFoundContext((prev) => (prev !== null ? null : prev))
    // Intentionally preserve `foundResult` until next submit — a stale found
    // card is less harmful than losing it on a single keystroke.
  }

  const { execute, isPending } = useAction(lookupMahadByEmail, {
    onSuccess: ({ data, input }) => {
      if (!data) return
      if (data.found) {
        setFoundResult(data)
        setNotFoundContext(null)
        return
      }
      setFoundResult(null)
      setNotFoundContext(input.email)
    },
    onError: ({ error }) => {
      if (error.validationErrors) {
        applySafeActionValidationErrorsToForm(form, error.validationErrors)
        return
      }
      // Preserve last-good result on transient errors; surface friendly toast.
      const message =
        typeof error.serverError === 'string' &&
        /too many attempts/i.test(error.serverError)
          ? error.serverError
          : 'Something went wrong. Please try again.'
      toast.error(message)
    },
  })

  const onSubmit = (data: MahadLookupByEmailValues) => {
    execute(data)
  }

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="email"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel className="text-base font-medium">
                  Email address
                  <span aria-hidden="true" className="text-destructive">
                    {' '}
                    *
                  </span>
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="you@example.com"
                    aria-required="true"
                    aria-invalid={!!fieldState.error}
                    disabled={isPending}
                    className={getInputClassNames(!!fieldState.error)}
                    onChange={(e) => {
                      clearResultsOnEdit()
                      field.onChange(e)
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
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
      {notFoundContext && (
        <ResultNotFoundCard
          method="email"
          attemptedIdentifier={notFoundContext}
        />
      )}
    </div>
  )
}
