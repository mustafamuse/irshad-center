'use client'

/**
 * Client-side CSV download hook
 * Handles browser-specific download functionality
 */
export function downloadCSV(content: string, filename?: string): void {
  const timestamp = new Date().toISOString().split('T')[0]
  const defaultFilename = `dugsi-families-${timestamp}.csv`

  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.setAttribute('href', url)
  link.setAttribute('download', filename || defaultFilename)
  link.style.visibility = 'hidden'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}
