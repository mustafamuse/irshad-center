'use client'

import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { FormStatus } from './types'

interface ActionButtonProps {
  status: FormStatus
  isLoading: boolean
  onConfirm: () => Promise<void>
  onSetup: () => Promise<void>
  disabled: boolean
}

export function ActionButton({
  status,
  isLoading,
  onConfirm,
  onSetup,
  disabled,
}: ActionButtonProps) {
  return (
    <div className={cn('relative w-full', 'bg-transparent', 'mt-4 md:mt-6')}>
      <div className="mx-auto max-w-[500px] md:max-w-none">
        <Button
          onClick={status === 'requires_confirmation' ? onConfirm : onSetup}
          disabled={disabled}
          className="h-12 w-full bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {status === 'requires_confirmation'
                ? 'Confirming...'
                : 'Setting up...'}
            </>
          ) : status === 'requires_confirmation' ? (
            'Confirm Bank Account Setup'
          ) : status === 'requires_payment_method' ? (
            'Retry Setup'
          ) : status === 'requires_action' ? (
            'Try Again'
          ) : status === 'processing' ? (
            'Processing...'
          ) : (
            'Set up bank account'
          )}
        </Button>
      </div>
    </div>
  )
}
