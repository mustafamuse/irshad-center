'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { AttendanceFetchError } from '@/lib/features/attendance/client'
import { useSubmitExcuseMutation } from '@/lib/features/attendance/hooks/teacher'

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
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const mutation = useSubmitExcuseMutation(teacherId, sessionToken)

  const trimmedLength = reason.trim().length
  const isValid = trimmedLength >= 10

  async function handleSubmit() {
    if (!isValid) return
    setError(null)

    try {
      await mutation.mutateAsync({
        attendanceRecordId,
        reason: reason.trim(),
      })
      setReason('')
      onSuccess()
    } catch (err) {
      if (err instanceof AttendanceFetchError) {
        setError(err.message)
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Failed to submit excuse. Please try again.')
      }
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void handleSubmit()
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
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={!isValid || mutation.isPending}
          >
            {mutation.isPending ? 'Submitting...' : 'Submit'}
          </Button>
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  )
}
