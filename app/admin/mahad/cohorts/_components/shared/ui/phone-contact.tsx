'use client'

import { useState } from 'react'

import { MessageCircle, Phone } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { createClientLogger } from '@/lib/logger-client'
import { cn } from '@/lib/utils'

const logger = createClientLogger('PhoneContact')

interface PhoneContactProps {
  phone: string
  name?: string
  compact?: boolean
  className?: string
}

export function PhoneContact({
  phone,
  name,
  compact = false,
  className,
}: PhoneContactProps) {
  const [copied, setCopied] = useState(false)

  // Clean phone number for tel: links (remove spaces, dashes, etc.)
  const cleanPhone = phone.replace(/[^\d+]/g, '')

  // Format for WhatsApp (remove + and any leading 1 for US numbers)
  const whatsappPhone = cleanPhone.replace(/^\+?1?/, '').replace(/\D/g, '')

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(phone)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      logger.error('Failed to copy phone', error)
    }
  }

  const handleCall = () => {
    window.location.href = `tel:${cleanPhone}`
  }

  const handleWhatsApp = () => {
    const message = name ? `Hi ${name},` : 'Hi,'
    const encodedMessage = encodeURIComponent(message)
    window.open(
      `https://wa.me/${whatsappPhone}?text=${encodedMessage}`,
      '_blank'
    )
  }

  if (compact) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn('h-8 w-8 p-0', className)}
            title="Contact options"
          >
            <Phone className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleCall}>
            <Phone className="mr-2 h-4 w-4" />
            Call {phone}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleWhatsApp}>
            <MessageCircle className="mr-2 h-4 w-4" />
            WhatsApp
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCopy}>
            {copied ? '✓ Copied' : 'Copy Number'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="font-mono">{phone}</span>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={handleCall}
          title="Call"
        >
          <Phone className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={handleWhatsApp}
          title="WhatsApp"
        >
          <MessageCircle className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}
