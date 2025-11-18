'use client'

import { Loader2 } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { BatchWithCount } from '@/lib/types/batch'

interface TransferProgressProps {
  batches?: BatchWithCount[]
}

export function TransferProgress({ batches: _batches }: TransferProgressProps) {
  // This component was used to show progress during mutations
  // Since we're now using useTransition for pending states,
  // and the progress is shown inline in the action buttons,
  // this component can be simplified or removed.
  // Keeping it for now but making it inactive.
  const isActive = false

  if (!isActive) {
    return null
  }

  const getStatusText = () => {
    return 'Processing...'
  }

  return (
    <Card className="p-4">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm font-medium">{getStatusText()}</span>
        </div>

        <Progress value={undefined} className="h-2" />

        <p className="text-xs text-muted-foreground">
          Please wait while we process your request...
        </p>
      </div>
    </Card>
  )
}
