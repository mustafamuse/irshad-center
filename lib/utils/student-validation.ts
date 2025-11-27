import { BatchStudentData } from '@/lib/actions/get-batch-data'

export interface StudentCompleteness {
  isComplete: boolean
  missingFields: string[]
}

export function getStudentCompleteness(
  student: BatchStudentData
): StudentCompleteness {
  const requiredFields = {
    phone: student.phone ?? null,
    dateOfBirth: student.dateOfBirth ?? null,
    // Mahad billing fields - these determine the rate
    billingType: student.billingType ?? null,
    graduationStatus: student.graduationStatus ?? null,
    paymentFrequency: student.paymentFrequency ?? null,
  }

  const hasAllFields = Object.values(requiredFields).every(
    (field) => field !== null && field !== ''
  )

  // Parse the date string to compare
  const isRecentlyUpdated = new Date(student.updatedAt) > new Date('2025-02-14')

  const missingFields = Object.entries(requiredFields)
    .filter(([_, value]) => !value)
    .map(([field]) => field)

  // Add "needs review" to missing fields if data is old
  if (!isRecentlyUpdated && missingFields.length === 0) {
    missingFields.push('needs review')
  }

  return {
    isComplete: hasAllFields && isRecentlyUpdated,
    missingFields,
  }
}
