/**
 * Filter utilities for Mahad students
 * Pure functions for filtering logic
 */

import { MahadStudent, PaymentHealth, StudentFilters } from '../_types'
import { calculatePaymentHealth } from './grouping'

export function filterBySearch(
  students: MahadStudent[],
  query: string
): MahadStudent[] {
  if (!query.trim()) return students

  const lowerQuery = query.toLowerCase().trim()
  return students.filter((student) => {
    const searchableFields = [
      student.name,
      student.email,
      student.phone,
      student.batch?.name,
    ]
    return searchableFields.some((field) =>
      field?.toLowerCase().includes(lowerQuery)
    )
  })
}

export function filterByBatch(
  students: MahadStudent[],
  batchId: string | null
): MahadStudent[] {
  if (!batchId) return students
  if (batchId === 'unassigned') {
    return students.filter((s) => !s.batchId)
  }
  return students.filter((s) => s.batchId === batchId)
}

export function filterByPaymentHealth(
  students: MahadStudent[],
  paymentHealth: PaymentHealth | null
): MahadStudent[] {
  if (!paymentHealth) return students
  return students.filter((s) => calculatePaymentHealth(s) === paymentHealth)
}

export function applyAllFilters(
  students: MahadStudent[],
  filters: StudentFilters
): MahadStudent[] {
  let result = students

  if (filters.search) {
    result = filterBySearch(result, filters.search)
  }

  if (filters.batchId !== null) {
    result = filterByBatch(result, filters.batchId)
  }

  if (filters.paymentHealth !== null) {
    result = filterByPaymentHealth(result, filters.paymentHealth)
  }

  return result
}
