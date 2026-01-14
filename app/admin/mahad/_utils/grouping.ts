/**
 * Grouping utilities for Mahad students
 * Pure functions for batch grouping and duplicate detection
 */

import { StudentStatus } from '@/lib/types/student'

import {
  DashboardStats,
  DuplicateGroup,
  MahadBatch,
  MahadStudent,
  PaymentHealth,
} from '../_types'

export interface BatchGroup {
  batch: MahadBatch | null
  students: MahadStudent[]
}

export function calculatePaymentHealth(student: MahadStudent): PaymentHealth {
  if (student.status === StudentStatus.REGISTERED) {
    return 'pending'
  }

  if (student.status !== StudentStatus.ENROLLED) {
    return 'inactive'
  }

  if (student.billingType === 'EXEMPT') {
    return 'exempt'
  }

  if (!student.subscription) {
    return 'needs_action'
  }

  const subStatus = student.subscription.status.toLowerCase()
  if (subStatus === 'active' || subStatus === 'trialing') {
    return 'healthy'
  }
  if (subStatus === 'past_due') {
    return 'at_risk'
  }

  return 'needs_action'
}

export function groupStudentsByBatch(
  students: MahadStudent[],
  batches: MahadBatch[]
): BatchGroup[] {
  const batchMap = new Map<string | null, MahadStudent[]>()

  for (const student of students) {
    const key = student.batchId ?? null
    const existing = batchMap.get(key) || []
    existing.push(student)
    batchMap.set(key, existing)
  }

  const groups: BatchGroup[] = []

  for (const batch of batches) {
    const batchStudents = batchMap.get(batch.id) || []
    groups.push({ batch, students: batchStudents })
    batchMap.delete(batch.id)
  }

  const unassigned = batchMap.get(null) || []
  if (unassigned.length > 0) {
    groups.push({ batch: null, students: unassigned })
  }

  return groups
}

export function calculateStats(students: MahadStudent[]): DashboardStats {
  const stats: DashboardStats = {
    total: students.length,
    enrolled: 0,
    healthy: 0,
    atRisk: 0,
    needsAction: 0,
    exempt: 0,
    pending: 0,
    inactive: 0,
  }

  for (const student of students) {
    const health = calculatePaymentHealth(student)

    if (student.status === StudentStatus.ENROLLED) {
      stats.enrolled++
    }

    switch (health) {
      case 'healthy':
        stats.healthy++
        break
      case 'at_risk':
        stats.atRisk++
        break
      case 'needs_action':
        stats.needsAction++
        break
      case 'exempt':
        stats.exempt++
        break
      case 'pending':
        stats.pending++
        break
      case 'inactive':
        stats.inactive++
        break
    }
  }

  return stats
}

function selectKeepRecord(students: MahadStudent[]): MahadStudent {
  const sorted = [...students].sort((a, b) => {
    if (a.subscription && !b.subscription) return -1
    if (!a.subscription && b.subscription) return 1
    if (a.batchId && !b.batchId) return -1
    if (!a.batchId && b.batchId) return 1
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })
  return sorted[0]
}

export function detectDuplicates(students: MahadStudent[]): DuplicateGroup[] {
  const duplicates: DuplicateGroup[] = []
  const seen = new Map<
    string,
    { matchValue: string; students: MahadStudent[] }
  >()

  for (const student of students) {
    if (student.email) {
      const normalizedEmail = student.email.toLowerCase()
      const emailKey = `email:${normalizedEmail}`
      const existing = seen.get(emailKey) || {
        matchValue: normalizedEmail,
        students: [],
      }
      existing.students.push(student)
      seen.set(emailKey, existing)
    }

    if (student.phone) {
      const normalized = student.phone.replace(/\D/g, '')
      if (normalized.length >= 10) {
        const phoneKey = `phone:${normalized.slice(-10)}`
        const existing = seen.get(phoneKey) || {
          matchValue: student.phone,
          students: [],
        }
        existing.students.push(student)
        seen.set(phoneKey, existing)
      }
    }
  }

  Array.from(seen.entries()).forEach(
    ([key, { matchValue, students: group }]) => {
      if (group.length > 1) {
        const matchType = key.startsWith('email:') ? 'email' : 'phone'
        const keepRecord = selectKeepRecord(group)
        const duplicateRecords = group.filter((s) => s.id !== keepRecord.id)

        duplicates.push({
          key,
          matchValue,
          matchType: matchType as 'email' | 'phone',
          students: group,
          keepRecord,
          duplicateRecords,
        })
      }
    }
  )

  return duplicates
}
