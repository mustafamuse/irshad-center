'use client'

import { useState } from 'react'

import { Copy, Check } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface CopyableTextProps {
  text: string
  children: React.ReactNode
  label?: string
  className?: string
  iconSize?: 'sm' | 'md'
  showIcon?: boolean
}

export function CopyableText({
  text,
  children,
  label = 'text',
  className,
  iconSize = 'sm',
  showIcon = true,
}: CopyableTextProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success(`${label} copied to clipboard`)

      // Reset icon after 2 seconds
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      toast.error('Failed to copy to clipboard')
    }
  }

  const iconClasses = cn(
    'transition-colors',
    iconSize === 'sm' ? 'h-3 w-3' : 'h-4 w-4',
    copied ? 'text-green-600' : 'text-muted-foreground hover:text-foreground'
  )

  return (
    <div className={cn('group flex items-center gap-1', className)}>
      <span className="min-w-0 flex-1">{children}</span>
      {showIcon && (
        <Button
          variant="ghost"
          size="sm"
          className="h-auto p-1 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={handleCopy}
          title={`Copy ${label}`}
        >
          {copied ? (
            <Check className={iconClasses} />
          ) : (
            <Copy className={iconClasses} />
          )}
        </Button>
      )}
    </div>
  )
}

// Helper component for clickable copyable text (entire area is clickable)
export function ClickableCopyableText({
  text,
  children,
  label = 'text',
  className,
}: Omit<CopyableTextProps, 'showIcon'>) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success(`${label} copied to clipboard`)

      // Reset icon after 2 seconds
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      toast.error('Failed to copy to clipboard')
    }
  }

  return (
    <button
      onClick={handleCopy}
      className={cn(
        'flex w-full items-center justify-between gap-2 rounded-sm p-1 text-left transition-colors hover:bg-muted/50',
        className
      )}
      title={`Click to copy ${label}`}
    >
      <span className="min-w-0 flex-1">{children}</span>
      {copied ? (
        <Check className="h-3 w-3 text-green-600" />
      ) : (
        <Copy className="h-3 w-3 text-muted-foreground" />
      )}
    </button>
  )
}
