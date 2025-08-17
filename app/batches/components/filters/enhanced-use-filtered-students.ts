import { useMemo, useCallback } from 'react'

import { isWithinInterval, parseISO } from 'date-fns'

import type { BatchStudentData } from '@/lib/actions/get-batch-data'

import { StudentFilters } from './types'

// Enhanced search interface with highlighting support
export interface EnhancedSearchResult {
  students: (BatchStudentData & { searchMatches?: SearchMatch[] })[]
  totalResults: number
  searchTime: number
}

export interface SearchMatch {
  field: 'name' | 'email' | 'phone'
  value: string
  highlightRanges: { start: number; end: number }[]
}

// Fuzzy search implementation without external dependencies
function fuzzySearch(needle: string, haystack: string): boolean {
  const needleLower = needle.toLowerCase()
  const haystackLower = haystack.toLowerCase()

  // Exact match gets highest priority
  if (haystackLower.includes(needleLower)) {
    return true
  }

  // Fuzzy matching: allow for missing characters
  let needleIndex = 0
  let haystackIndex = 0

  while (
    needleIndex < needleLower.length &&
    haystackIndex < haystackLower.length
  ) {
    if (needleLower[needleIndex] === haystackLower[haystackIndex]) {
      needleIndex++
    }
    haystackIndex++
  }

  return needleIndex === needleLower.length
}

// Create highlighted ranges for search matches
function getHighlightRanges(
  text: string,
  searchTerm: string
): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = []
  const textLower = text.toLowerCase()
  const searchLower = searchTerm.toLowerCase()

  let startIndex = 0
  while (true) {
    const index = textLower.indexOf(searchLower, startIndex)
    if (index === -1) break

    ranges.push({
      start: index,
      end: index + searchTerm.length,
    })
    startIndex = index + 1
  }

  return ranges
}

// Create search matches for a student
function createSearchMatches(
  student: BatchStudentData,
  searchTerm: string
): SearchMatch[] {
  const matches: SearchMatch[] = []

  // Check name
  if (student.name && fuzzySearch(searchTerm, student.name)) {
    matches.push({
      field: 'name',
      value: student.name,
      highlightRanges: getHighlightRanges(student.name, searchTerm),
    })
  }

  // Check email
  if (student.email && fuzzySearch(searchTerm, student.email)) {
    matches.push({
      field: 'email',
      value: student.email,
      highlightRanges: getHighlightRanges(student.email, searchTerm),
    })
  }

  // Check phone (normalize for search)
  if (student.phone) {
    const normalizedPhone = student.phone.replace(/\D/g, '')
    const normalizedSearch = searchTerm.replace(/\D/g, '')
    if (normalizedSearch && normalizedPhone.includes(normalizedSearch)) {
      matches.push({
        field: 'phone',
        value: student.phone,
        highlightRanges: [], // Phone highlighting is more complex, skip for now
      })
    }
  }

  return matches
}

export function useEnhancedFilteredStudents(
  students: BatchStudentData[],
  filters: StudentFilters
): EnhancedSearchResult {
  // Memoize the expensive filtering operation
  const filteredResult = useMemo(() => {
    const startTime = performance.now()

    let result = students

    // Apply batch filter first (usually most selective)
    if (filters.batch.selected) {
      if (filters.batch.selected === 'unassigned') {
        result = result.filter((student) => !student.batch)
      } else {
        result = result.filter(
          (student) => student.batch?.id === filters.batch.selected
        )
      }
    }

    // Apply status filter
    if (filters.status.selected.length > 0) {
      result = result.filter((student) =>
        filters.status.selected.some(
          (status) => status.toLowerCase() === student.status.toLowerCase()
        )
      )
    }

    // Apply timeline filter (takes precedence over date range)
    if (filters.timeline.active) {
      result = result.filter((student) => {
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
        const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

        const enrollmentDate = parseISO(student.createdAt)
        const activityDate = parseISO(student.updatedAt)

        switch (filters.timeline.active) {
          case 'enrolled-today':
            return enrollmentDate >= today
          case 'enrolled-week':
            return enrollmentDate >= weekAgo
          case 'enrolled-month':
            return enrollmentDate >= monthAgo
          case 'active-today':
            return activityDate >= today
          case 'active-week':
            return activityDate >= weekAgo
          case 'active-month':
            return activityDate >= monthAgo
          default:
            return true
        }
      })
    }
    // Apply custom date range filter (only if no timeline filter)
    else if (filters.dateRange.range.from || filters.dateRange.range.to) {
      result = result.filter((student) => {
        const dateField =
          filters.dateRange.field === 'enrollmentDate'
            ? student.createdAt // Use createdAt as enrollment date
            : student.updatedAt // Use updatedAt as last activity date

        if (!dateField) return false

        const date =
          typeof dateField === 'string' ? parseISO(dateField) : dateField

        if (filters.dateRange.range.from && filters.dateRange.range.to) {
          return isWithinInterval(date, {
            start: filters.dateRange.range.from,
            end: filters.dateRange.range.to,
          })
        }

        if (filters.dateRange.range.from) {
          return date >= filters.dateRange.range.from
        }

        if (filters.dateRange.range.to) {
          return date <= filters.dateRange.range.to
        }

        return true
      })
    }

    // Apply academic filters
    if (filters.academic.educationLevel.length > 0) {
      result = result.filter(
        (student) =>
          student.educationLevel &&
          filters.academic.educationLevel.includes(student.educationLevel)
      )
    }

    if (filters.academic.gradeLevel.length > 0) {
      result = result.filter(
        (student) =>
          student.gradeLevel &&
          filters.academic.gradeLevel.includes(student.gradeLevel)
      )
    }

    // Apply enhanced search filter with highlighting
    if (filters.search.query.trim()) {
      const searchTerm = filters.search.query.trim()

      result = result
        .map((student) => {
          const matches = createSearchMatches(student, searchTerm)
          return matches.length > 0
            ? { ...student, searchMatches: matches }
            : null
        })
        .filter(
          (student): student is NonNullable<typeof student> => student !== null
        )
    }

    const endTime = performance.now()

    return {
      students: result,
      totalResults: result.length,
      searchTime: endTime - startTime,
    }
  }, [students, filters])

  return filteredResult
}

// Utility hook for search highlighting
export function useSearchHighlight() {
  const highlightText = useCallback(
    (text: string, ranges: { start: number; end: number }[]) => {
      if (!ranges.length) return text

      const parts: { text: string; isHighlight: boolean }[] = []
      let lastIndex = 0

      ranges.forEach(({ start, end }) => {
        if (start > lastIndex) {
          parts.push({ text: text.slice(lastIndex, start), isHighlight: false })
        }
        parts.push({ text: text.slice(start, end), isHighlight: true })
        lastIndex = end
      })

      if (lastIndex < text.length) {
        parts.push({ text: text.slice(lastIndex), isHighlight: false })
      }

      return parts
    },
    []
  )

  return { highlightText }
}
