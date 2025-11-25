'use client'

import { useEffect } from 'react'

import Link from 'next/link'

import { AlertCircle, ArrowLeft } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

export default function StudentDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Student detail page error:', error)
  }, [error])

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Back button */}
      <div>
        <Link href="/admin/mahad/cohorts">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Cohorts
          </Button>
        </Link>
      </div>

      {/* Error alert */}
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Failed to load student details</AlertTitle>
        <AlertDescription className="mt-2">
          <p className="mb-4">{error.message}</p>
          <div className="flex gap-2">
            <Button onClick={reset} variant="outline" size="sm">
              Try again
            </Button>
            <Link href="/admin/mahad/cohorts">
              <Button variant="outline" size="sm">
                Return to list
              </Button>
            </Link>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  )
}
