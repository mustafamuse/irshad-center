'use client'

import { useEffect } from 'react'

import { AlertCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import messages from '@/messages/en.json'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function RegistrationSuccessError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Registration success page error:', error)
  }, [error])

  return (
    <main className="container mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-900">
            <AlertCircle className="h-5 w-5" />
            Error Loading Registrations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-red-700">{messages.dugsi.success.errorLoading}</p>
          <Button onClick={reset} variant="outline">
            Try Again
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
