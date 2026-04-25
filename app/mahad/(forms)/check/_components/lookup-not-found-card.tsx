import Link from 'next/link'

import { AlertCircle } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

export function LookupNotFoundCard() {
  return (
    <Alert
      variant="warning"
      role="status"
      aria-live="polite"
      className="rounded-2xl p-6 md:p-8"
    >
      <AlertCircle className="h-5 w-5" />
      <AlertTitle className="text-base font-semibold">
        No registration found
      </AlertTitle>
      <AlertDescription className="mt-1 space-y-4">
        <p>
          We could not find a Māhad registration matching those details.
          Double-check the name and phone number you used when registering.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="brand">
            <Link href="/mahad/register">Register for Māhad</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-14 rounded-full border-amber-300 text-amber-800 hover:bg-amber-100 md:h-12"
          >
            <Link href="/mahad">Back to home</Link>
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}
