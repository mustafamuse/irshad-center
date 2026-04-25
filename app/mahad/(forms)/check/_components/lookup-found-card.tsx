import { CheckCircle2 } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

interface LookupFoundCardProps {
  registeredAt: string
  programStatusLabel: string
}

export function LookupFoundCard({
  registeredAt,
  programStatusLabel,
}: LookupFoundCardProps) {
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(registeredAt))

  return (
    <Alert
      variant="success"
      role="status"
      aria-live="polite"
      className="overflow-hidden rounded-2xl p-0"
    >
      <div className="p-6 md:p-8">
        <div className="flex gap-4">
          <CheckCircle2
            className="mt-0.5 h-5 w-5 shrink-0"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1 space-y-4">
            <div>
              <AlertTitle className="text-base font-semibold">
                Registration on file
              </AlertTitle>
              <AlertDescription className="mt-1 text-sm text-gray-600">
                A Māhad registration was found matching your details.
              </AlertDescription>
            </div>
            <dl className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2">
                <dt className="font-medium text-gray-700">Submitted</dt>
                <dd className="text-gray-600">{formattedDate}</dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="font-medium text-gray-700">Status</dt>
                <dd>
                  <Badge
                    variant="outline"
                    className="border-brand/30 bg-brand/10 text-brand"
                  >
                    {programStatusLabel}
                  </Badge>
                </dd>
              </div>
            </dl>
            <p className="text-xs text-gray-400">
              If something looks wrong, contact the admin team with your full
              name and phone number.
            </p>
          </div>
        </div>
      </div>
      <div
        className="h-1 w-full"
        style={{
          background:
            'linear-gradient(90deg, hsl(var(--brand)) 0%, hsl(var(--brand-accent)) 100%)',
        }}
        aria-hidden="true"
      />
    </Alert>
  )
}
