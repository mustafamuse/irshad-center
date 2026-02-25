'use client'

import { useEffect } from 'react'

import { AlertCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'

export default function TeachersError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Teachers page error:', error)
  }, [error])

  return (
    <div className="container mx-auto p-6">
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-red-200 bg-red-50 p-8">
        <AlertCircle className="h-8 w-8 text-red-600" />
        <div className="text-center">
          <h2 className="text-lg font-semibold text-red-800">
            Something went wrong
          </h2>
          <p className="mt-1 text-sm text-red-600">
            Failed to load the teachers page. Please try again.
          </p>
          {error.digest && (
            <p className="mt-1 text-xs text-red-400">
              Error ID: {error.digest}
            </p>
          )}
        </div>
        <Button variant="outline" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  )
}
