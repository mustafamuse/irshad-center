/**
 * Parent Info Component
 * Reusable component for displaying parent information
 */

'use client'

import { Mail, Phone, Copy } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import { DugsiRegistration } from '../../_types'
import { formatParentName, hasSecondParent } from '../../_utils/format'

interface ParentInfoProps {
  registration: DugsiRegistration
  showEmail?: boolean
  showPhone?: boolean
  showSecondParentBadge?: boolean
}

export function ParentInfo({
  registration,
  showEmail = true,
  showPhone = true,
  showSecondParentBadge = true,
}: ParentInfoProps) {
  const parentName = formatParentName(
    registration.parentFirstName,
    registration.parentLastName
  )
  const hasSecond = hasSecondParent(registration)

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copied to clipboard`)
    } catch (err) {
      toast.error('Failed to copy to clipboard')
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="font-medium">{parentName}</span>
        {hasSecond && showSecondParentBadge && (
          <Badge variant="outline" className="text-xs">
            2 Parents
          </Badge>
        )}
      </div>

      {showEmail && registration.parentEmail && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Mail className="h-3.5 w-3.5" />
          <a
            href={`mailto:${registration.parentEmail}`}
            className="truncate hover:text-[#007078] hover:underline"
          >
            {registration.parentEmail}
          </a>
        </div>
      )}

      {showPhone && registration.parentPhone && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Phone className="h-3.5 w-3.5" />
          <a
            href={`https://wa.me/${registration.parentPhone.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#007078] hover:underline"
          >
            {registration.parentPhone}
          </a>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={() =>
              registration.parentPhone &&
              copyToClipboard(registration.parentPhone, 'Phone number')
            }
            aria-label="Copy phone number"
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  )
}
