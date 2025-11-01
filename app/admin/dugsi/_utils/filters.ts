/**
 * Filtering utilities for families
 * Centralized filtering logic for consistent filtering behavior
 */

import { Family, FamilyFilters, DateFilter, TabValue } from '../_types'

/**
 * Get date range from filter type
 */
export function getDateRange(
  filter: DateFilter
): { start: Date; end: Date } | null {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  switch (filter) {
    case 'all':
      return null
    case 'today':
      return {
        start: today,
        end: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      }
    case 'yesterday':
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
      return { start: yesterday, end: today }
    case 'thisWeek':
      const dayOfWeek = today.getDay()
      const startOfWeek = new Date(
        today.getTime() - dayOfWeek * 24 * 60 * 60 * 1000
      )
      return {
        start: startOfWeek,
        end: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      }
    case 'lastWeek':
      const dayOfWeek2 = today.getDay()
      const startOfLastWeek = new Date(
        today.getTime() - (dayOfWeek2 + 7) * 24 * 60 * 60 * 1000
      )
      const endOfLastWeek = new Date(
        today.getTime() - dayOfWeek2 * 24 * 60 * 60 * 1000
      )
      return { start: startOfLastWeek, end: endOfLastWeek }
  }
}

/**
 * Filter families by search query
 */
export function filterFamiliesBySearch(
  families: Family[],
  query: string
): Family[] {
  if (!query) return families

  const normalizedQuery = query.toLowerCase()

  return families.filter((family) => {
    return family.members.some(
      (member) =>
        member.name?.toLowerCase().includes(normalizedQuery) ||
        member.parentEmail?.toLowerCase().includes(normalizedQuery) ||
        member.parentPhone?.includes(query) ||
        member.schoolName?.toLowerCase().includes(normalizedQuery)
    )
  })
}

/**
 * Filter families by advanced filters
 */
export function filterFamiliesByAdvanced(
  families: Family[],
  filters: FamilyFilters
): Family[] {
  let filtered = families

  // Date range filter
  if (filters.dateRange) {
    filtered = filtered.filter((family) => {
      return family.members.some((member) => {
        const date = new Date(member.createdAt)
        return date >= filters.dateRange!.start && date < filters.dateRange!.end
      })
    })
  }

  // School filter
  if (filters.schools.length > 0) {
    filtered = filtered.filter((family) => {
      return family.members.some((member) =>
        filters.schools.includes(member.schoolName || '')
      )
    })
  }

  // Grade filter
  if (filters.grades.length > 0) {
    filtered = filtered.filter((family) => {
      return family.members.some((member) =>
        filters.grades.includes(member.gradeLevel || '')
      )
    })
  }

  // Health info filter
  if (filters.hasHealthInfo) {
    filtered = filtered.filter((family) => {
      return family.members.some(
        (member) =>
          member.healthInfo && member.healthInfo.toLowerCase() !== 'none'
      )
    })
  }

  return filtered
}

/**
 * Filter families by tab
 */
export function filterFamiliesByTab(
  families: Family[],
  tab: TabValue
): Family[] {
  switch (tab) {
    case 'overview':
      return families // Show all
    case 'active':
      return families.filter((f) => f.hasSubscription)
    case 'pending':
      return families.filter((f) => f.hasPayment && !f.hasSubscription)
    case 'needs-attention':
      return families.filter((f) => !f.hasPayment)
    case 'all':
      return families
  }
}

/**
 * Composite filter function
 */
export function applyAllFilters(
  families: Family[],
  options: {
    tab?: TabValue
    searchQuery?: string
    advancedFilters?: FamilyFilters
  }
): Family[] {
  let filtered = families

  if (options.tab) {
    filtered = filterFamiliesByTab(filtered, options.tab)
  }

  if (options.searchQuery) {
    filtered = filterFamiliesBySearch(filtered, options.searchQuery)
  }

  if (options.advancedFilters) {
    filtered = filterFamiliesByAdvanced(filtered, options.advancedFilters)
  }

  return filtered
}
