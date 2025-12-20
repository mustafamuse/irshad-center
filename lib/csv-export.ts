/**
 * CSV Export Utility
 * Exports family/registration data to CSV format
 */
import { Family } from '@/app/admin/dugsi/_types'
import {
  getFamilyStatus,
  getPrimaryPayerPhone,
} from '@/app/admin/dugsi/_utils/family'
import { formatParentName } from '@/app/admin/dugsi/_utils/format'
import { formatPhoneNumber, formatCurrency } from '@/lib/utils/formatters'

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
    'Primary Payer Indicator',
    'Primary Payer Phone',
    'Parent Name',
    'Parent Phone',
    'Parent 2 Name',
    'Parent 2 Phone',
    'Children Count',
    'Subscription Status',
    'Subscription Amount',
    'Status',
    'Registration Date',
  ]

  const rows = families.map((family) => {
    const firstMember = family.members[0]
    if (!firstMember) return []

    const primaryPayerIndicator =
      firstMember.primaryPayerParentNumber === 2
        ? 'Parent 2'
        : firstMember.primaryPayerParentNumber === 1
          ? 'Parent 1'
          : 'Not Set'

    const primaryPayerPhoneResult = getPrimaryPayerPhone(family)
    const primaryPayerPhone = formatPhoneNumber(primaryPayerPhoneResult.phone)

    const parent1Phone = formatPhoneNumber(firstMember.parentPhone)
    const parent2Phone = formatPhoneNumber(firstMember.parent2Phone)

    const subscriptionStatus = firstMember.subscriptionStatus || '—'
    const subscriptionAmount = firstMember.subscriptionAmount
      ? formatCurrency(firstMember.subscriptionAmount)
      : '—'

    return [
      primaryPayerIndicator,
      primaryPayerPhone,
      formatParentName(firstMember.parentFirstName, firstMember.parentLastName),
      parent1Phone,
      formatParentName(
        firstMember.parent2FirstName,
        firstMember.parent2LastName
      ),
      parent2Phone,
      family.members.length,
      subscriptionStatus,
      subscriptionAmount,
      getFamilyStatus(family),
      new Date(firstMember.createdAt).toLocaleDateString(),
    ]
  })

  // Convert to CSV string
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
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
