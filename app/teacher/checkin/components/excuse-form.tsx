'use client'

import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

import { submitExcuseAction } from '../actions'

interface Props {
  attendanceRecordId: string
  onSuccess: () => void
}

export function ExcuseForm({ attendanceRecordId, onSuccess }: Props) {
  const [isPending, startTransition] = useTransition()
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const isValid = reason.trim().length >= 10

  function handleSubmit() {
    if (!isValid) return
    setError(null)

    startTransition(async () => {
      const result = await submitExcuseAction({
        attendanceRecordId,
        reason: reason.trim(),
      })

      if (result?.serverError) {
        setError(result.serverError)
        return
      }

      setReason('')
      onSuccess()
    })
  }

  return (
    <div className="mt-2 space-y-2 rounded-md border bg-white p-3">
      <p className="text-xs font-medium text-muted-foreground">Request excuse</p>

      <Textarea
        autoFocus
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Explain your absence (min 10 characters)..."
        rows={3}
        maxLength={1000}
        className="text-sm"
      />

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {reason.trim().length}/1000{reason.trim().length < 10 && ` (${10 - reason.trim().length} more needed)`}
        </span>
        <Button
          size="sm"
          disabled={!isValid || isPending}
          onClick={handleSubmit}
        >
          {isPending ? 'Submitting...' : 'Submit'}
        </Button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
