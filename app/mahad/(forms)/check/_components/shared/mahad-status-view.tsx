import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  MessageCircle,
  Pause,
  XCircle,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  buildMahadWhatsAppLink,
  MAHAD_WHATSAPP_E164,
} from '@/lib/constants/mahad'
import type {
  LookupResult,
  MahadStatusView as StatusView,
} from '@/lib/services/mahad/verification-service'

type FoundResult = Extract<LookupResult, { found: true }>

interface MahadStatusViewProps {
  result: FoundResult
  /** Optional context for tailoring the WhatsApp pre-fill message. */
  context?: 'just_registered' | 'verifying'
}

const STATUS_VISUALS: Record<
  StatusView['kind'],
  {
    Icon: typeof CheckCircle2
    alertVariant: 'success' | 'warning' | 'default' | 'destructive'
    badgeClass: string
  }
> = {
  awaiting_payment_link: {
    Icon: Clock,
    alertVariant: 'default',
    badgeClass: 'border-brand/30 bg-brand/10 text-brand',
  },
  payment_link_sent: {
    Icon: MessageCircle,
    alertVariant: 'default',
    badgeClass: 'border-amber-300 bg-amber-50 text-amber-800',
  },
  payment_confirmed: {
    Icon: CheckCircle2,
    alertVariant: 'success',
    badgeClass: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  },
  payment_processing: {
    Icon: Loader2,
    alertVariant: 'default',
    badgeClass: 'border-sky-300 bg-sky-50 text-sky-800',
  },
  payment_issue: {
    Icon: AlertTriangle,
    alertVariant: 'warning',
    badgeClass: 'border-amber-300 bg-amber-50 text-amber-800',
  },
  payment_canceled: {
    Icon: XCircle,
    alertVariant: 'destructive',
    badgeClass: 'border-rose-300 bg-rose-50 text-rose-800',
  },
  on_leave: {
    Icon: Pause,
    alertVariant: 'warning',
    badgeClass: 'border-amber-300 bg-amber-50 text-amber-800',
  },
  withdrawn: {
    Icon: XCircle,
    alertVariant: 'destructive',
    badgeClass: 'border-rose-300 bg-rose-50 text-rose-800',
  },
  completed: {
    Icon: CheckCircle2,
    alertVariant: 'success',
    badgeClass: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  },
  suspended: {
    Icon: Pause,
    alertVariant: 'warning',
    badgeClass: 'border-amber-300 bg-amber-50 text-amber-800',
  },
}

export function MahadStatusView({
  result,
  context = 'verifying',
}: MahadStatusViewProps) {
  const { Icon, alertVariant, badgeClass } = STATUS_VISUALS[result.status.kind]
  const formattedDate = formatRegisteredDate(result.registeredAt)
  const whatsAppMessage =
    context === 'just_registered'
      ? `Hi, I just registered for Māhad (reference ${result.profileId}). I have a question.`
      : `Hi, I'm checking on my Māhad registration (reference ${result.profileId}).`

  return (
    <Alert
      variant={alertVariant}
      role="status"
      aria-live="polite"
      className="overflow-hidden rounded-2xl p-0"
    >
      <div className="space-y-5 p-6 md:p-8">
        <div className="flex gap-4">
          <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1 space-y-2">
            <AlertTitle className="text-base font-semibold">
              {context === 'just_registered'
                ? `You're all set, ${result.firstName}`
                : `Hi, ${result.firstName}`}
            </AlertTitle>
            <AlertDescription className="text-sm text-gray-600">
              <Badge variant="outline" className={badgeClass}>
                {result.status.label}
              </Badge>
              <p className="mt-2">{result.status.detail}</p>
            </AlertDescription>
          </div>
        </div>

        <dl className="space-y-1.5 border-t border-gray-100 pt-4 text-sm">
          <div className="flex items-center gap-2">
            <dt className="font-medium text-gray-700">Submitted</dt>
            <dd className="text-gray-600">{formattedDate}</dd>
          </div>
          <div className="flex items-start gap-2">
            <dt className="font-medium text-gray-700">Reference</dt>
            <dd className="break-all font-mono text-xs text-gray-600">
              {result.profileId}
            </dd>
          </div>
        </dl>

        {result.status.guidance !== 'none' && (
          <Button asChild variant="brand" className="w-full">
            <a
              href={buildMahadWhatsAppLink(whatsAppMessage)}
              target="_blank"
              rel="noopener noreferrer"
            >
              {result.status.guidance === 'check_whatsapp'
                ? 'Message us on WhatsApp'
                : 'Contact admin on WhatsApp'}
            </a>
          </Button>
        )}

        <p className="text-xs text-gray-400">
          Save this page or its URL — you can quote the reference if you contact
          admin (WhatsApp +1 {formatUsPhone(MAHAD_WHATSAPP_E164)}).
        </p>
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

function formatRegisteredDate(isoDate: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(isoDate))
}

function formatUsPhone(e164: string): string {
  // "16125177466" -> "612-517-7466"
  const tenDigits = e164.startsWith('1') ? e164.slice(1) : e164
  if (tenDigits.length !== 10) return e164
  return `${tenDigits.slice(0, 3)}-${tenDigits.slice(3, 6)}-${tenDigits.slice(6)}`
}
