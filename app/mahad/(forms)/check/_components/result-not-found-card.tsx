import Link from 'next/link'

import { AlertCircle, MessageCircle } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { buildMahadWhatsAppLink } from '@/lib/constants/mahad'

interface ResultNotFoundCardProps {
  method: 'email' | 'name'
  /** What the user typed — folded into the WhatsApp pre-fill so admin has context. */
  attemptedIdentifier: string
}

export function ResultNotFoundCard({
  method,
  attemptedIdentifier,
}: ResultNotFoundCardProps) {
  const otherMethod = method === 'email' ? 'name + date of birth' : 'email'
  const message =
    method === 'email'
      ? `Hi, I tried to look up my Māhad registration with the email "${attemptedIdentifier}" but couldn't find it. Can you help?`
      : `Hi, I tried to look up my Māhad registration as "${attemptedIdentifier}" but couldn't find it. Can you help?`

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
          We could not find a Māhad registration matching that{' '}
          {method === 'email' ? 'email' : 'name and date of birth'}.
          Double-check what you entered, or try the other tab to look up by{' '}
          {otherMethod}.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="brand">
            <a
              href={buildMahadWhatsAppLink(message)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle className="mr-2 h-4 w-4" aria-hidden="true" />
              Message us on WhatsApp
            </a>
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-14 rounded-full border-amber-300 text-amber-800 hover:bg-amber-100 md:h-12"
          >
            <Link href="/mahad">Back to home</Link>
          </Button>
        </div>
        <p className="text-xs text-amber-900/70">
          Haven&apos;t registered yet?{' '}
          <Link
            href="/mahad/register"
            className="font-medium underline underline-offset-2"
          >
            Start a registration
          </Link>
          .
        </p>
      </AlertDescription>
    </Alert>
  )
}
