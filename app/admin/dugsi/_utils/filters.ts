/**
 * Filtering utilities for families
 * Centralized filtering logic for consistent filtering behavior
 */

import { Shift } from '@prisma/client'

import {
  Family,
  FamilyFilters,
  DateFilter,
  TabValue,
  SearchField,
} from '../_types'
import { hasBillingMismatch } from './billing'

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

export function filterFamiliesBySearch(
  families: Family[],
  query: string,
  field: SearchField = 'all'
): Family[] {
  if (!query) return families

  const normalizedQuery = query.toLowerCase().trim()
  const searchDigits = query.replace(/\D/g, '')

  return families.filter((family) => {
    return family.members.some((member) => {
      switch (field) {
        case 'email':
          return (
            member.parentEmail?.toLowerCase().includes(normalizedQuery) ||
            member.parent2Email?.toLowerCase().includes(normalizedQuery)
          )

        case 'phone': {
          const searchLast4 = searchDigits.slice(-4)
          if (searchLast4.length < 4) return false
          const parent1Digits = member.parentPhone?.replace(/\D/g, '') || ''
          const parent2Digits = member.parent2Phone?.replace(/\D/g, '') || ''
          return (
            parent1Digits.endsWith(searchLast4) ||
            parent2Digits.endsWith(searchLast4)
          )
        }

        case 'childName':
          return (member.name?.toLowerCase() || '').includes(normalizedQuery)

        case 'parentName': {
          const parent1Name =
            `${member.parentFirstName || ''} ${member.parentLastName || ''}`.toLowerCase()
          const parent2Name =
            `${member.parent2FirstName || ''} ${member.parent2LastName || ''}`.toLowerCase()
          return (
            parent1Name.includes(normalizedQuery) ||
            parent2Name.includes(normalizedQuery)
          )
        }

        case 'all':
        default: {
          const isEmailSearch = normalizedQuery.includes('@')
          const isPhoneSearch = searchDigits.length >= 4

          if (isEmailSearch) {
            return (
              member.parentEmail?.toLowerCase().includes(normalizedQuery) ||
              member.parent2Email?.toLowerCase().includes(normalizedQuery)
            )
          }

          if (isPhoneSearch) {
            const searchLast4 = searchDigits.slice(-4)
            const parent1Digits = member.parentPhone?.replace(/\D/g, '') || ''
            const parent2Digits = member.parent2Phone?.replace(/\D/g, '') || ''
            return (
              parent1Digits.endsWith(searchLast4) ||
              parent2Digits.endsWith(searchLast4)
            )
          }

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
        }
      }
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
    case 'active':
      return families.filter((f) => f.hasSubscription)
    case 'churned':
      return families.filter((f) => f.hasChurned && !f.hasSubscription)
    case 'needs-attention':
      return families.filter((f) => !f.hasPayment && !f.hasChurned)
    case 'billing-mismatch':
      return families.filter(
        (f) => f.hasSubscription && f.members.some((m) => hasBillingMismatch(m))
      )
    case 'overview':
    case 'all':
      return families
  }
}

/**
 * Sort families alphabetically by parent first name
 */
export function sortFamiliesByParentName(families: Family[]): Family[] {
  return [...families].sort((a, b) => {
    const aParent = a.members[0]
    const bParent = b.members[0]

    // Use first member's parent1 name, fallback to parent2, then empty string
    const aFirstName =
      aParent?.parentFirstName || aParent?.parent2FirstName || ''
    const bFirstName =
      bParent?.parentFirstName || bParent?.parent2FirstName || ''

    // Primary sort: first name (case-insensitive)
    const firstNameCompare = aFirstName
      .toLowerCase()
      .localeCompare(bFirstName.toLowerCase(), 'en', { sensitivity: 'base' })

    if (firstNameCompare !== 0) return firstNameCompare

    // Secondary sort: last name
    const aLastName = aParent?.parentLastName || aParent?.parent2LastName || ''
    const bLastName = bParent?.parentLastName || bParent?.parent2LastName || ''

    return aLastName
      .toLowerCase()
      .localeCompare(bLastName.toLowerCase(), 'en', { sensitivity: 'base' })
  })
}

export function filterFamiliesByShift(
  families: Family[],
  shift: Shift | null
): Family[] {
  if (!shift) return families
  return families.filter((f) => f.members.some((m) => m.shift === shift))
}

export function filterFamiliesByTeacher(
  families: Family[],
  teacher: string | null
): Family[] {
  if (!teacher) return families
  return families.filter((f) =>
    f.members.some((m) => m.teacherName === teacher)
  )
}

export function applyAllFilters(
  families: Family[],
  options: {
    tab?: TabValue
    searchQuery?: string
    searchField?: SearchField
    advancedFilters?: FamilyFilters
    quickShift?: Shift | null
    quickTeacher?: string | null
  }
): Family[] {
  let filtered = families

  if (options.tab) {
    filtered = filterFamiliesByTab(filtered, options.tab)
  }

  if (options.searchQuery) {
    filtered = filterFamiliesBySearch(
      filtered,
      options.searchQuery,
      options.searchField
    )
  }

  if (options.advancedFilters) {
    filtered = filterFamiliesByAdvanced(filtered, options.advancedFilters)
  }

  if (options.quickShift) {
    filtered = filterFamiliesByShift(filtered, options.quickShift)
  }

  if (options.quickTeacher) {
    filtered = filterFamiliesByTeacher(filtered, options.quickTeacher)
  }

  filtered = sortFamiliesByParentName(filtered)

  return filtered
}
