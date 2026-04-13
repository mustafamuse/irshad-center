'use client'

import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

import { submitExcuseAction } from '../actions'

interface ExcuseFormProps {
  attendanceRecordId: string
  teacherId: string
  sessionToken: string
  onSuccess: () => void
  onCancel: () => void
}

export function ExcuseForm({
  attendanceRecordId,
  teacherId,
  sessionToken,
  onSuccess,
  onCancel,
}: ExcuseFormProps) {
  const [isPending, startTransition] = useTransition()
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const trimmedLength = reason.trim().length
  const isValid = trimmedLength >= 10

  function handleSubmit() {
    if (!isValid) return
    setError(null)

    startTransition(async () => {
      const result = await submitExcuseAction({
        attendanceRecordId,
        teacherId,
        token: sessionToken,
        reason: reason.trim(),
      })

      if (result?.serverError || result?.validationErrors) {
        setError(result.serverError ?? 'Invalid request. Please try again.')
        return
      }

      setReason('')
      onSuccess()
    })
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        handleSubmit()
      }}
      className="mt-2 space-y-2 rounded-md border bg-white p-3"
    >
      <p className="text-xs font-medium text-muted-foreground">
        Request excuse
      </p>

      <Textarea
        autoFocus
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Explain your absence (min 10 characters)…"
        rows={3}
        maxLength={1000}
        className="text-sm"
      />

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {trimmedLength}/1000
          {trimmedLength < 10 && ` (${10 - trimmedLength} more needed)`}
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={!isValid || isPending}>
            {isPending ? 'Submitting...' : 'Submit'}
          </Button>
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  )
}
