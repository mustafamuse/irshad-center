/**
 * CSV Export Utility
 * Exports family/registration data to CSV format
 */
import { Family } from '@/app/admin/dugsi/_types'
import { getFamilyStatus } from '@/app/admin/dugsi/_utils/family'
import { formatParentName } from '@/app/admin/dugsi/_utils/format'

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
    'Family Key',
    'Parent Name',
    'Parent Email',
    'Parent Phone',
    'Parent 2 Name',
    'Parent 2 Email',
    'Parent 2 Phone',
    'Children Count',
    'Children Names',
    'Status',
    'Customer ID',
    'Subscription ID',
    'Registration Date',
  ]

  const rows = families.map((family) => {
    const firstMember = family.members[0]
    if (!firstMember) return []

    return [
      family.familyKey,
      formatParentName(firstMember.parentFirstName, firstMember.parentLastName),
      firstMember.parentEmail || '',
      firstMember.parentPhone || '',
      formatParentName(
        firstMember.parent2FirstName,
        firstMember.parent2LastName
      ),
      firstMember.parent2Email || '',
      firstMember.parent2Phone || '',
      family.members.length,
      family.members.map((m) => m.name).join('; '),
      getFamilyStatus(family),
      firstMember.stripeCustomerIdDugsi || '',
      firstMember.stripeSubscriptionIdDugsi || '',
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
