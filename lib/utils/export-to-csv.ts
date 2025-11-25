import { saveAs } from 'file-saver'

export function exportToCSV(
  data: unknown[],
  visibleColumns: string[],
  filename: string
) {
  // Create headers row
  const headers = visibleColumns.map((col) =>
    col.replace(/([A-Z])/g, ' $1').trim()
  )

  // Create data rows
  const rows = data.map((item) =>
    visibleColumns.map((col) => {
      const value = (item as unknown as Record<string, unknown>)[col]
      // Handle different value types
      if (value === null || value === undefined) return ''
      if (value instanceof Date) return value.toLocaleDateString()
      if (typeof value === 'boolean') return value ? 'Yes' : 'No'
      return String(value).replace(/,/g, ';') // Prevent CSV confusion
    })
  )

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\n')

  // Create and download file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  saveAs(blob, `${filename}.csv`)
}
