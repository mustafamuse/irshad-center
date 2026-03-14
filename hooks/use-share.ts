'use client'

import { useCallback, useState } from 'react'

export function useShare(
  path: string,
  shareData: { title: string; text: string }
) {
  const [copied, setCopied] = useState(false)

  const handleShare = useCallback(async () => {
    try {
      const url = window.location.origin + path
      const data = { ...shareData, url }

      if (navigator.share) {
        await navigator.share(data)
      } else {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Share failed', err)
      }
    }
  }, [path, shareData])

  return { copied, handleShare }
}
