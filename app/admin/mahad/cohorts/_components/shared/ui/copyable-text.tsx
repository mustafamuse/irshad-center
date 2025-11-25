'use client'

import { useState } from 'react'

import { Check, Copy } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { createClientLogger } from '@/lib/logger-client'
import { cn } from '@/lib/utils'

const logger = createClientLogger('CopyableText')

interface CopyableTextProps {
  text: string
  label?: string
  children: React.ReactNode
  className?: string
}

export function CopyableText({
  text,
  label,
  children,
  className,
}: CopyableTextProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      logger.error('Failed to copy text', error)
    }
  }

  return (
    <div className={cn('group relative flex items-center', className)}>
      {children}
      <Button
        variant="ghost"
        size="sm"
        className="ml-2 h-6 w-6 p-0 opacity-0 transition-opacity group-hover:opacity-100"
        onClick={handleCopy}
        title={`Copy ${label || 'text'}`}
      >
        {copied ? (
          <Check className="h-3 w-3 text-green-600" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
      </Button>
    </div>
  )
}
