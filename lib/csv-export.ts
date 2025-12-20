/**
 * CSV Export Utility
 * Generates CSV content from family/registration data
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
 * Generate CSV content from families data
 * Pure function - returns CSV string without side effects
 */
export function generateFamiliesCSV(families: Family[]): string {
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
            firstMember.parent2LastName,
            ''
          )
        : formatFullName(
            firstMember.parentFirstName,
            firstMember.parentLastName,
            ''
          )

      const primaryPayerPhoneResult = getPrimaryPayerPhone(family)
      const payerPhone = primaryPayerPhoneResult.phone
        ? formatPhoneNumber(primaryPayerPhoneResult.phone)
        : ''

      const otherParentName = isPrimaryPayerParent2
        ? formatFullName(
            firstMember.parentFirstName,
            firstMember.parentLastName,
            ''
          )
        : formatFullName(
            firstMember.parent2FirstName,
            firstMember.parent2LastName,
            ''
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
        family.members.length.toString(),
        subscriptionStatus,
        subscriptionAmount,
        getFamilyStatus(family),
        new Date(firstMember.createdAt).toLocaleDateString(),
      ]
    })
    .filter((row): row is Array<string> => row !== null)

  // Convert to CSV string
  return [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n')
}
