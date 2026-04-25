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

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const log = useLogger()

  useEffect(() => {
    Sentry.captureException(error, {
      tags: { route: 'mahad-register' },
    })

    log.error('Mahad registration error', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    })
    void log.flush()
  }, [error, log])

  return (
    <div className="container mx-auto flex min-h-screen items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-destructive">
            Something went wrong
          </CardTitle>
          <CardDescription className="text-center">
            An error occurred while loading this page
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {error.message || 'An unexpected error occurred'}
          </p>
          <div className="flex justify-center gap-4">
            <Button onClick={() => reset()} variant="default">
              Try again
            </Button>
            <Button
              onClick={() => (window.location.href = '/mahad')}
              variant="outline"
            >
              Go home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
