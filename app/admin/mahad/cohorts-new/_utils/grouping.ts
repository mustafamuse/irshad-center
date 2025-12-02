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
} from '../_types'

export interface BatchGroup {
  batch: MahadBatch | null
  students: MahadStudent[]
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
    active: 0,
    registered: 0,
    onLeave: 0,
    unpaid: 0,
  }

  for (const student of students) {
    switch (student.status) {
      case StudentStatus.ENROLLED:
        stats.active++
        break
      case StudentStatus.REGISTERED:
        stats.registered++
        break
      case StudentStatus.ON_LEAVE:
        stats.onLeave++
        break
    }

    if (!student.subscription || student.subscription.status !== 'ACTIVE') {
      stats.unpaid++
    }
  }

  return stats
}

export function detectDuplicates(students: MahadStudent[]): DuplicateGroup[] {
  const duplicates: DuplicateGroup[] = []
  const seen = new Map<string, MahadStudent[]>()

  for (const student of students) {
    if (student.email) {
      const emailKey = `email:${student.email.toLowerCase()}`
      const existing = seen.get(emailKey) || []
      existing.push(student)
      seen.set(emailKey, existing)
    }

    if (student.phone) {
      const normalized = student.phone.replace(/\D/g, '')
      if (normalized.length >= 10) {
        const phoneKey = `phone:${normalized.slice(-10)}`
        const existing = seen.get(phoneKey) || []
        existing.push(student)
        seen.set(phoneKey, existing)
      }
    }
  }

  Array.from(seen.entries()).forEach(([key, group]) => {
    if (group.length > 1) {
      const matchType = key.startsWith('email:') ? 'email' : 'phone'
      duplicates.push({
        key,
        students: group,
        matchType: matchType as 'email' | 'phone',
      })
    }
  })

  return duplicates
}
