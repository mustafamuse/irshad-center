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
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body>
        {/* This is the default Next.js error component. It includes styles to match the default Next.js error page. */}
        <NextError statusCode={undefined as never} />
      </body>
    </html>
  )
}
