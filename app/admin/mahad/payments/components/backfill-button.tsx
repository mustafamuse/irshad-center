'use client'

import { useState } from 'react'

import { Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

import { runPaymentsBackfill } from '../actions'

export function BackfillPaymentsButton() {
  const [isBackfilling, setIsBackfilling] = useState(false)

  async function handleBackfill() {
    setIsBackfilling(true)
    const { success, error } = await runPaymentsBackfill()
    setIsBackfilling(false)

    if (success) {
      toast.success('Backfill Complete', {
        description: error,
      })
    } else {
      toast.error('Backfill Failed', {
        description: error,
      })
    }
  }

  return (
    <Button onClick={handleBackfill} disabled={isBackfilling}>
      {isBackfilling ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Sparkles className="mr-2 h-4 w-4" />
      )}
      Backfill Stripe Payments
    </Button>
  )
}
