'use client'

import { useMemo } from 'react'

import { MahadStudent, StudentFilters } from '../_types'
import { applyAllFilters } from '../_utils'

export function useStudentFilters(
  students: MahadStudent[],
  filters: StudentFilters
): MahadStudent[] {
  return useMemo(() => applyAllFilters(students, filters), [students, filters])
}
