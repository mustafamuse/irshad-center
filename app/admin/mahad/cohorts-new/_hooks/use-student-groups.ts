'use client'

import { useMemo } from 'react'

import {
  DashboardStats,
  DuplicateGroup,
  MahadBatch,
  MahadStudent,
} from '../_types'
import {
  BatchGroup,
  calculateStats,
  detectDuplicates,
  groupStudentsByBatch,
} from '../_utils'

export function useStudentGroups(
  students: MahadStudent[],
  batches: MahadBatch[]
): BatchGroup[] {
  return useMemo(
    () => groupStudentsByBatch(students, batches),
    [students, batches]
  )
}

export function useStudentStats(students: MahadStudent[]): DashboardStats {
  return useMemo(() => calculateStats(students), [students])
}

export function useDuplicates(students: MahadStudent[]): DuplicateGroup[] {
  return useMemo(() => detectDuplicates(students), [students])
}
