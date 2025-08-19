'use client'

import { useEffect } from 'react'

import { useRouter } from 'next/navigation'

import { CheckCircle2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useEnrollment } from '@/contexts/enrollment-context'

export default function SuccessPage() {
  const router = useRouter()
  const {
    actions: { resetForm },
  } = useEnrollment()

  useEffect(() => {
    resetForm()
  }, [resetForm])

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <Card>
          <CardHeader className="text-center">
            <div className="mb-4 flex justify-center">
              <CheckCircle2 className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-2xl">Enrollment Complete!</CardTitle>
            <CardDescription className="text-base">
              Your automatic payments have been set up successfully.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg border bg-muted/50 p-4">
              <h3 className="mb-2 font-semibold">What&apos;s Next?</h3>
              <ul className="ml-6 list-disc space-y-2 text-sm text-muted-foreground">
                <li>Your first payment will be processed in couple of days</li>
                <li>
                  You&apos;ll receive email confirmations for all payments
                </li>
                <li>You can view your payment history in your email</li>
                <li>
                  Contact support if you need to update your payment method
                </li>
              </ul>
            </div>

            <Button className="w-full" onClick={() => router.push('/')}>
              Return Home
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
