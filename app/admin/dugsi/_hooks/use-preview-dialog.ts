'use client'

import { useEffect, useState } from 'react'

import type { ActionResult } from '../_types'

interface UsePreviewDialogOptions<T> {
  open: boolean
  fetchPreview: () => Promise<ActionResult<T>>
}

export function usePreviewDialog<T>({
  open,
  fetchPreview,
}: UsePreviewDialogOptions<T>) {
  const [preview, setPreview] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && !preview) {
      setIsLoading(true)
      setError(null)
      fetchPreview()
        .then((result) => {
          if (result.success && result.data) {
            setPreview(result.data)
          } else {
            setError(result.error ?? 'Failed to load preview')
          }
        })
        .catch((err: unknown) => {
          setError(
            err instanceof Error ? err.message : 'Failed to load preview'
          )
        })
        .finally(() => setIsLoading(false))
    }
  }, [open, preview, fetchPreview])

  useEffect(() => {
    if (!open) {
      setPreview(null)
      setError(null)
    }
  }, [open])

  return { preview, isLoading, error }
}
