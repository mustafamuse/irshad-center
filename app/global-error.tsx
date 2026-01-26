'use client'

import { useEffect } from 'react'

import NextError from 'next/error'

import * as Sentry from '@sentry/nextjs'

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string }
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { route: 'global-error' },
      contexts: { errorBoundary: { digest: error.digest } },
    })
  }, [error])

  return (
    <html lang="en">
      <body>
        <NextError statusCode={500} />
      </body>
    </html>
  )
}
