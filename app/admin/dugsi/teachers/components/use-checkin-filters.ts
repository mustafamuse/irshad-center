'use client'

import { useCallback, useState, useTransition, useEffect } from 'react'

import { Shift } from '@prisma/client'

import { TeacherOption, getTeachersForDropdownAction } from '../actions'

export interface CheckinFiltersState {
  isPending: boolean
  teachers: TeacherOption[]
  teachersError: string | null
  shiftFilter: Shift | 'all'
  teacherFilter: string | 'all'
}

export interface CheckinFiltersActions {
  startTransition: (callback: () => void) => void
  setShiftFilter: (value: Shift | 'all') => void
  setTeacherFilter: (value: string | 'all') => void
}

export function useCheckinFilters(
  initialTeachers?: TeacherOption[]
): CheckinFiltersState & CheckinFiltersActions {
  const [isPending, startTransition] = useTransition()
  const [teachers, setTeachers] = useState<TeacherOption[]>(
    initialTeachers ?? []
  )
  const [teachersError, setTeachersError] = useState<string | null>(null)
  const [shiftFilter, setShiftFilter] = useState<Shift | 'all'>('all')
  const [teacherFilter, setTeacherFilter] = useState<string | 'all'>('all')

  const loadTeachers = useCallback(() => {
    startTransition(async () => {
      const result = await getTeachersForDropdownAction()
      if (result.success && result.data) {
        setTeachers(result.data)
        setTeachersError(null)
      } else {
        setTeachersError(result.error || 'Failed to load teachers')
      }
    })
  }, [])

  useEffect(() => {
    if (initialTeachers && initialTeachers.length > 0) return
    loadTeachers()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialTeachers is only checked on mount
  }, [loadTeachers])

  return {
    isPending,
    teachers,
    teachersError,
    shiftFilter,
    teacherFilter,
    startTransition,
    setShiftFilter,
    setTeacherFilter,
  }
}
