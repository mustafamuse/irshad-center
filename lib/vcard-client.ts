'use client'

import { toast } from 'sonner'

import { formatSkipSummary, type VCardResult } from '@/lib/vcard-export'

interface VCardActionResult {
  data?: VCardResult
  serverError?: string
}

interface HandleVCardExportOptions {
  emptyMessage: string
  successMessage: (exported: number) => string
}

export function handleVCardExport(
  result: VCardActionResult | undefined,
  { emptyMessage, successMessage }: HandleVCardExportOptions
): void {
  if (!result?.data) {
    toast.error(result?.serverError ?? 'Failed to generate contacts')
    return
  }

  const { content, filename, exported } = result.data
  if (exported === 0) {
    toast.error(emptyMessage)
    return
  }

  const downloaded = downloadVCardFile(content, filename)
  if (!downloaded) {
    toast.error('Failed to download file')
    return
  }

  toast.success(`${successMessage(exported)}${formatSkipSummary(result.data)}`)
}

function downloadVCardFile(content: string, filename: string): boolean {
  try {
    const blob = new Blob([content], { type: 'text/vcard;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    return true
  } catch {
    return false
  }
}
