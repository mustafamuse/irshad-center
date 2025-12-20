/**
 * CSV Export Utility
 * Exports family/registration data to CSV format
 */
import { Family } from '@/app/admin/dugsi/_types'
import {
  getFamilyStatus,
  getPrimaryPayerPhone,
} from '@/app/admin/dugsi/_utils/family'
import {
  formatPhoneNumber,
  formatCurrency,
  formatFullName,
} from '@/lib/utils/formatters'

/**
 * Export families to CSV file
 */
export function exportFamiliesToCSV(
  families: Family[],
  filename?: string
): void {
  const timestamp = new Date().toISOString().split('T')[0]
  const defaultFilename = `dugsi-families-${timestamp}.csv`

  const headers = [
    'Primary Payer',
    'Payer Name',
    'Payer Phone',
    'Other Parent Name',
    'Other Parent Phone',
    'Children Count',
    'Subscription Status',
    'Subscription Amount',
    'Status',
    'Registration Date',
  ]

  const rows = families
    .map((family) => {
      const firstMember = family.members[0]
      if (!firstMember) return null

      const isPrimaryPayerParent2 = firstMember.primaryPayerParentNumber === 2

      const primaryPayerIndicator =
        firstMember.primaryPayerParentNumber === 2
          ? 'Parent 2'
          : firstMember.primaryPayerParentNumber === 1
            ? 'Parent 1'
            : 'Not Set'

      const payerName = isPrimaryPayerParent2
        ? formatFullName(
            firstMember.parent2FirstName,
            firstMember.parent2LastName
          )
        : formatFullName(
            firstMember.parentFirstName,
            firstMember.parentLastName
          )

      const primaryPayerPhoneResult = getPrimaryPayerPhone(family)
      const payerPhone = primaryPayerPhoneResult.phone
        ? formatPhoneNumber(primaryPayerPhoneResult.phone)
        : ''

      const otherParentName = isPrimaryPayerParent2
        ? formatFullName(
            firstMember.parentFirstName,
            firstMember.parentLastName
          )
        : formatFullName(
            firstMember.parent2FirstName,
            firstMember.parent2LastName
          )

      const otherParentPhone = isPrimaryPayerParent2
        ? firstMember.parentPhone
          ? formatPhoneNumber(firstMember.parentPhone)
          : ''
        : firstMember.parent2Phone
          ? formatPhoneNumber(firstMember.parent2Phone)
          : ''

      const subscriptionStatus = firstMember.subscriptionStatus || ''
      const subscriptionAmount =
        firstMember.subscriptionAmount != null
          ? formatCurrency(firstMember.subscriptionAmount)
          : ''

      return [
        primaryPayerIndicator,
        payerName,
        payerPhone,
        otherParentName,
        otherParentPhone,
        family.members.length,
        subscriptionStatus,
        subscriptionAmount,
        getFamilyStatus(family),
        new Date(firstMember.createdAt).toLocaleDateString(),
      ]
    })
    .filter((row): row is Array<string | number> => row !== null)

  // Convert to CSV string
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row
        .map((cell) => {
          // Don't quote numbers to preserve numeric type in Excel/Google Sheets
          if (typeof cell === 'number') {
            return String(cell)
          }
          // Quote strings and escape existing quotes
          return `"${String(cell).replace(/"/g, '""')}"`
        })
        .join(',')
    ),
  ].join('\n')

  // Create and download file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.setAttribute('href', url)
  link.setAttribute('download', filename || defaultFilename)
  link.style.visibility = 'hidden'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  // Clean up
  URL.revokeObjectURL(url)
}
