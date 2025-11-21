import { saveAs } from 'file-saver'
import * as XLSX from 'xlsx'

export function exportToExcel(
  data: unknown[],
  visibleColumns: string[],
  filename: string
) {
  // Create headers row (convert camelCase to Title Case)
  const headers = visibleColumns.map((col) =>
    col
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  )

  // Create data rows with proper formatting
  const rows = data.map((item) =>
    visibleColumns.map((col) => {
      const value = item[col]

      // Handle different value types
      if (value === null || value === undefined) return ''
      if (value instanceof Date) return value.toLocaleDateString()
      if (typeof value === 'boolean') return value ? 'Yes' : 'No'
      if (typeof value === 'object') return JSON.stringify(value)
      return value
    })
  )

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])

  // Set column widths
  const colWidths = headers.map((header) => ({
    wch: Math.max(header.length, 15), // minimum 15 characters
  }))
  ws['!cols'] = colWidths

  // Create workbook
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Students')

  // Generate Excel file
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  // Save file
  saveAs(blob, `${filename}.xlsx`)
}
