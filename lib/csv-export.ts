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

  const rows = families.map((family) => {
    const firstMember = family.members[0]
    if (!firstMember) return []

    const isPrimaryPayerParent2 = firstMember.primaryPayerParentNumber === 2

    const payerName = isPrimaryPayerParent2
      ? formatParentName(
          firstMember.parent2FirstName,
          firstMember.parent2LastName
        )
      : formatParentName(
          firstMember.parentFirstName,
          firstMember.parentLastName
        )

    const primaryPayerPhoneResult = getPrimaryPayerPhone(family)
    const payerPhone = primaryPayerPhoneResult.phone
      ? formatPhoneNumber(primaryPayerPhoneResult.phone)
      : ''

    const otherParentName = isPrimaryPayerParent2
      ? formatParentName(
          firstMember.parentFirstName,
          firstMember.parentLastName
        )
      : formatParentName(
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

    const subscriptionStatus = firstMember.subscriptionStatus || '—'
    const subscriptionAmount = firstMember.subscriptionAmount
      ? formatCurrency(firstMember.subscriptionAmount)
      : '$0.00'

    return [
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
