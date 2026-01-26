'use client'

import { useEffect } from 'react'

import NextError from 'next/error'

import * as Sentry from '@sentry/nextjs'
import { useLogger } from 'next-axiom'

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string }
}) {
  const log = useLogger()

  useEffect(() => {
    Sentry.captureException(error, {
      tags: { route: 'global-error' },
      contexts: { errorBoundary: { digest: error.digest } },
    })

    log.error('Global error', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    })
  }, [error, log])

  return (
    <html lang="en">
      <body>
        <NextError statusCode={500} />
      </body>
    </html>
  )
}
