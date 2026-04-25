'use client'

import { useEffect } from 'react'

import * as Sentry from '@sentry/nextjs'
import { useLogger } from 'next-axiom'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default function MahadFormsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const log = useLogger()

  useEffect(() => {
    Sentry.captureException(error, {
      tags: { route: 'mahad-forms' },
    })

    log.error('Mahad public flow error', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    })
    void log.flush()
  }, [error, log])

  return (
    <Card className="overflow-hidden rounded-2xl border-0 bg-white p-6 shadow-sm ring-1 ring-gray-200 md:p-8">
      <CardHeader className="items-center space-y-2 px-0 pb-4 text-center">
        <CardTitle className="text-2xl font-semibold text-destructive">
          Something went wrong
        </CardTitle>
        <CardDescription>
          We hit a snag loading this page. Please try again, or head back to the
          Māhad home and try a different route.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-0">
        {error.message ? (
          <p className="text-center text-sm text-muted-foreground">
            {error.message}
          </p>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={() => reset()} variant="brand">
            Try again
          </Button>
          <Button
            variant="outline"
            className="h-14 rounded-full md:h-12"
            onClick={() => {
              window.location.href = '/mahad'
            }}
          >
            Back to home
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
