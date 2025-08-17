import { EducationLevel, GradeLevel } from '@prisma/client'

export type DateRangePreset = 'This Month' | 'Last Month' | 'Last 3 Months'
export type QuickFilterPreset = 'Active Only' | 'Inactive Only'
export type BatchQuickFilter = 'Unassigned' | 'Active Batches'

export interface DateRange {
  from: Date | null
  to: Date | null
}

export interface StudentFilters {
  batch: {
    selected: string | null // batch ID or 'unassigned'
    quickFilter: BatchQuickFilter | null
  }

  status: {
    selected: string[] // multiple statuses can be selected
    quickFilter: QuickFilterPreset | null
  }

  search: {
    query: string
    fields: ('name' | 'email' | 'phone')[]
  }

  dateRange: {
    field: 'enrollmentDate' | 'lastPaymentDate' // Maps to createdAt | updatedAt
    range: DateRange
    preset: DateRangePreset | null
  }

  timeline: {
    active:
      | 'enrolled-today'
      | 'enrolled-week'
      | 'enrolled-month'
      | 'active-today'
      | 'active-week'
      | 'active-month'
      | null
  }

  academic: {
    gradeLevel: GradeLevel[]
    educationLevel: EducationLevel[]
  }
}

export interface FilterChangeHandler<T> {
  (value: T): void
}

export interface UseStudentFilters {
  filters: StudentFilters
  setFilter: <K extends keyof StudentFilters>(
    key: K,
    value: StudentFilters[K]
  ) => void
  resetFilters: () => void
  hasActiveFilters: boolean
}

export const DEFAULT_FILTERS: StudentFilters = {
  batch: {
    selected: null,
    quickFilter: null,
  },
  status: {
    selected: [],
    quickFilter: null,
  },
  search: {
    query: '',
    fields: ['name', 'email', 'phone'],
  },
  dateRange: {
    field: 'enrollmentDate',
    range: { from: null, to: null },
    preset: null,
  },
  timeline: {
    active: null,
  },
  academic: {
    gradeLevel: [],
    educationLevel: [],
  },
}
