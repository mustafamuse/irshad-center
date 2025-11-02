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
 * Filter families by search query with smart detection
 */
export function filterFamiliesBySearch(
  families: Family[],
  query: string
): Family[] {
  if (!query) return families

  const normalizedQuery = query.toLowerCase().trim()

  // Smart detection based on query pattern
  const isEmailSearch = normalizedQuery.includes('@')
  const searchDigits = query.replace(/\D/g, '')
  const isPhoneSearch = searchDigits.length >= 4

  return families.filter((family) => {
    return family.members.some((member) => {
      // 1. Email search (if contains @)
      if (isEmailSearch) {
        return (
          member.parentEmail?.toLowerCase().includes(normalizedQuery) ||
          member.parent2Email?.toLowerCase().includes(normalizedQuery)
        )
      }

      // 2. Phone search (if 4+ digits) - match last 4 digits
      if (isPhoneSearch) {
        const searchLast4 = searchDigits.slice(-4)
        const parent1Digits = member.parentPhone?.replace(/\D/g, '') || ''
        const parent2Digits = member.parent2Phone?.replace(/\D/g, '') || ''

        return (
          parent1Digits.endsWith(searchLast4) ||
          parent2Digits.endsWith(searchLast4)
        )
      }

      // 3. Name search (default) - searches child + both parents
      const childName = member.name?.toLowerCase() || ''
      const parent1Name =
        `${member.parentFirstName || ''} ${member.parentLastName || ''}`.toLowerCase()
      const parent2Name =
        `${member.parent2FirstName || ''} ${member.parent2LastName || ''}`.toLowerCase()

      return (
        childName.includes(normalizedQuery) ||
        parent1Name.includes(normalizedQuery) ||
        parent2Name.includes(normalizedQuery)
      )
    })
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

  // Date filter
  const dateRange = getDateRange(filters.dateFilter)
  if (dateRange) {
    filtered = filtered.filter((family) => {
      return family.members.some((member) => {
        const date = new Date(member.createdAt)
        return date >= dateRange.start && date < dateRange.end
      })
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
