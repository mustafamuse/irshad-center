/**
 * CSV Export Utility for Mahad Students
 * Exports student data to CSV format for analysis and reporting
 */
import { BatchStudentData } from '@/lib/types/batch'
import { getStudentStatusDisplay } from '@/lib/types/student'
import { needsBankVerification } from '@/lib/utils/payment-status'

/**
 * Format subscription status for display
 */
function formatSubscriptionStatus(
  status: string | null,
  hasSubscription: boolean
): string {
  if (!hasSubscription || !status) return 'No Subscription'

  switch (status) {
    case 'active':
      return 'Active'
    case 'incomplete':
      return 'Incomplete'
    case 'past_due':
      return 'Past Due'
    case 'trialing':
      return 'Trialing'
    case 'canceled':
      return 'Canceled'
    case 'unpaid':
      return 'Unpaid'
    case 'incomplete_expired':
      return 'Expired'
    default:
      return status
  }
}

/**
 * Format parent name from first and last name
 */
function formatParentName(firstName?: string | null, lastName?: string | null): string {
  if (!firstName && !lastName) return ''
  if (firstName && lastName) return `${firstName} ${lastName}`
  return firstName || lastName || ''
}

/**
 * Export Mahad students to CSV file
 */
export function exportMahadStudentsToCSV(
  students: BatchStudentData[],
  filename?: string
): void {
  const timestamp = new Date().toISOString().split('T')[0]
  const defaultFilename = `mahad-students-${timestamp}.csv`

  const headers = [
    'Student Name',
    'Student Email',
    'Student Phone',
    'Parent Name',
    'Parent Email',
    'Parent Phone',
    'Parent 2 Name',
    'Parent 2 Email',
    'Parent 2 Phone',
    'Batch',
    'Status',
    'Payment Status',
    'Subscription ID',
    'Needs Bank Verification',
    'Education Level',
    'Grade Level',
    'School Name',
    'Date of Birth',
    'Siblings Count',
    'Registration Date',
  ]

  const rows = students.map((student) => {
    const hasSubscription = Boolean(student.stripeSubscriptionId)
    const paymentStatus = formatSubscriptionStatus(
      student.subscriptionStatus,
      hasSubscription
    )
    const needsVerification = needsBankVerification(student) ? 'Yes' : 'No'

    const activeSiblings = student.Sibling?.Student.filter(
      (sibling) =>
        sibling.id !== student.id &&
        (sibling.status === 'enrolled' || sibling.status === 'registered')
    ) || []

    return [
      student.name,
      student.email || '',
      student.phone || '',
      formatParentName(student.parentFirstName, student.parentLastName),
      student.parentEmail || '',
      student.parentPhone || '',
      formatParentName(student.parent2FirstName, student.parent2LastName),
      student.parent2Email || '',
      student.parent2Phone || '',
      student.Batch?.name || 'Unassigned',
      getStudentStatusDisplay(student.status as any),
      paymentStatus,
      student.stripeSubscriptionId || '',
      needsVerification,
      student.educationLevel || '',
      student.gradeLevel || '',
      student.schoolName || '',
      student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : '',
      activeSiblings.length.toString(),
      new Date(student.createdAt).toLocaleDateString(),
    ]
  })

  // Convert to CSV string with proper escaping
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
