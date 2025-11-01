/**
 * Filter Utilities Tests
 *
 * Tests for family filtering utilities
 */

import { describe, it, expect } from 'vitest'

import { Family, FamilyFilters } from '../../_types'
import {
  getDateRange,
  filterFamiliesBySearch,
  filterFamiliesByAdvanced,
  filterFamiliesByTab,
  applyAllFilters,
} from '../filters'

describe('getDateRange', () => {
  it('should return null for "all" filter', () => {
    const result = getDateRange('all')
    expect(result).toBeNull()
  })

  it('should return today range for "today" filter', () => {
    const result = getDateRange('today')
    expect(result).not.toBeNull()
    expect(result?.start).toBeInstanceOf(Date)
    expect(result?.end).toBeInstanceOf(Date)
    expect(result!.end.getTime()).toBeGreaterThan(result!.start.getTime())
  })

  it('should return yesterday range for "yesterday" filter', () => {
    const result = getDateRange('yesterday')
    expect(result).not.toBeNull()
    expect(result?.start).toBeInstanceOf(Date)
    expect(result?.end).toBeInstanceOf(Date)
    expect(result!.end.getTime()).toBeGreaterThan(result!.start.getTime())
  })

  it('should return this week range for "thisWeek" filter', () => {
    const result = getDateRange('thisWeek')
    expect(result).not.toBeNull()
    expect(result?.start).toBeInstanceOf(Date)
    expect(result?.end).toBeInstanceOf(Date)
    expect(result!.end.getTime()).toBeGreaterThan(result!.start.getTime())
  })

  it('should return last week range for "lastWeek" filter', () => {
    const result = getDateRange('lastWeek')
    expect(result).not.toBeNull()
    expect(result?.start).toBeInstanceOf(Date)
    expect(result?.end).toBeInstanceOf(Date)
    expect(result!.end.getTime()).toBeGreaterThan(result!.start.getTime())
  })
})

describe('filterFamiliesBySearch', () => {
  const createFamily = (member: Partial<Family['members'][0]>): Family => ({
    familyKey: 'family-1',
    members: [
      {
        id: 'id-1',
        name: member.name || 'Test Child',
        parentEmail: member.parentEmail || 'parent@example.com',
        parentPhone: member.parentPhone || '123-456-7890',
        schoolName: member.schoolName || 'Test School',
        createdAt: new Date(),
      } as Family['members'][0],
    ],
    hasPayment: false,
    hasSubscription: false,
    parentEmail: member.parentEmail || 'parent@example.com',
    parentPhone: member.parentPhone || '123-456-7890',
  })

  it('should return all families when query is empty', () => {
    const families = [createFamily({})]
    const result = filterFamiliesBySearch(families, '')
    expect(result).toEqual(families)
  })

  it('should filter by name (case insensitive)', () => {
    const families = [
      createFamily({ name: 'John Doe' }),
      createFamily({ name: 'Jane Smith' }),
    ]
    const result = filterFamiliesBySearch(families, 'john')
    expect(result).toHaveLength(1)
    expect(result[0].members[0].name).toBe('John Doe')
  })

  it('should filter by email (case insensitive)', () => {
    const families = [
      createFamily({ parentEmail: 'parent1@example.com' }),
      createFamily({ parentEmail: 'parent2@example.com' }),
    ]
    const result = filterFamiliesBySearch(families, 'parent1')
    expect(result).toHaveLength(1)
    expect(result[0].members[0].parentEmail).toBe('parent1@example.com')
  })

  it('should filter by phone number', () => {
    const families = [
      createFamily({ parentPhone: '123-456-7890' }),
      createFamily({ parentPhone: '987-654-3210' }),
    ]
    const result = filterFamiliesBySearch(families, '123-456')
    expect(result).toHaveLength(1)
    expect(result[0].members[0].parentPhone).toBe('123-456-7890')
  })

  it('should filter by school name (case insensitive)', () => {
    const families = [
      createFamily({ schoolName: 'School A' }),
      createFamily({ schoolName: 'School B' }),
    ]
    const result = filterFamiliesBySearch(families, 'school a')
    expect(result).toHaveLength(1)
    expect(result[0].members[0].schoolName).toBe('School A')
  })

  it('should return empty array when no matches found', () => {
    const families = [createFamily({ name: 'John Doe' })]
    const result = filterFamiliesBySearch(families, 'xyz')
    expect(result).toEqual([])
  })
})

describe('filterFamiliesByAdvanced', () => {
  const createFamily = (member: Partial<Family['members'][0]>): Family => ({
    familyKey: 'family-1',
    members: [
      {
        id: 'id-1',
        createdAt: member.createdAt || new Date('2024-01-15'),
        schoolName: member.schoolName || 'School A',
        gradeLevel: member.gradeLevel || 'GRADE_1',
        healthInfo: member.healthInfo || 'None',
      } as Family['members'][0],
    ],
    hasPayment: false,
    hasSubscription: false,
    parentEmail: 'parent@example.com',
    parentPhone: '123-456-7890',
  })

  it('should return all families when no filters applied', () => {
    const families = [createFamily({})]
    const filters: FamilyFilters = {
      dateRange: null,
      schools: [],
      grades: [],
      hasHealthInfo: false,
    }
    const result = filterFamiliesByAdvanced(families, filters)
    expect(result).toEqual(families)
  })

  it('should filter by date range', () => {
    const startDate = new Date('2024-01-01')
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date('2024-01-31')
    endDate.setHours(23, 59, 59, 999)

    const families = [
      createFamily({ createdAt: new Date('2024-01-15') }),
      createFamily({ createdAt: new Date('2024-02-15') }),
    ]
    const filters: FamilyFilters = {
      dateRange: { start: startDate, end: endDate },
      schools: [],
      grades: [],
      hasHealthInfo: false,
    }
    const result = filterFamiliesByAdvanced(families, filters)
    expect(result).toHaveLength(1)
    expect(result[0].members[0].createdAt).toEqual(new Date('2024-01-15'))
  })

  it('should filter by schools', () => {
    const families = [
      createFamily({ schoolName: 'School A' }),
      createFamily({ schoolName: 'School B' }),
    ]
    const filters: FamilyFilters = {
      dateRange: null,
      schools: ['School A'],
      grades: [],
      hasHealthInfo: false,
    }
    const result = filterFamiliesByAdvanced(families, filters)
    expect(result).toHaveLength(1)
    expect(result[0].members[0].schoolName).toBe('School A')
  })

  it('should filter by grades', () => {
    const families = [
      createFamily({ gradeLevel: 'GRADE_1' }),
      createFamily({ gradeLevel: 'GRADE_2' }),
    ]
    const filters: FamilyFilters = {
      dateRange: null,
      schools: [],
      grades: ['GRADE_1'],
      hasHealthInfo: false,
    }
    const result = filterFamiliesByAdvanced(families, filters)
    expect(result).toHaveLength(1)
    expect(result[0].members[0].gradeLevel).toBe('GRADE_1')
  })

  it('should filter by health info', () => {
    const families = [
      createFamily({ healthInfo: 'Allergies' }),
      createFamily({ healthInfo: 'None' }),
    ]
    const filters: FamilyFilters = {
      dateRange: null,
      schools: [],
      grades: [],
      hasHealthInfo: true,
    }
    const result = filterFamiliesByAdvanced(families, filters)
    expect(result).toHaveLength(1)
    expect(result[0].members[0].healthInfo).toBe('Allergies')
  })

  it('should apply multiple filters together', () => {
    const startDate = new Date('2024-01-01')
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date('2024-01-31')
    endDate.setHours(23, 59, 59, 999)

    const families = [
      createFamily({
        createdAt: new Date('2024-01-15'),
        schoolName: 'School A',
        gradeLevel: 'GRADE_1',
      }),
      createFamily({
        createdAt: new Date('2024-01-15'),
        schoolName: 'School B',
        gradeLevel: 'GRADE_1',
      }),
    ]
    const filters: FamilyFilters = {
      dateRange: { start: startDate, end: endDate },
      schools: ['School A'],
      grades: ['GRADE_1'],
      hasHealthInfo: false,
    }
    const result = filterFamiliesByAdvanced(families, filters)
    expect(result).toHaveLength(1)
    expect(result[0].members[0].schoolName).toBe('School A')
  })
})

describe('filterFamiliesByTab', () => {
  const createFamily = (
    hasPayment: boolean,
    hasSubscription: boolean
  ): Family => ({
    familyKey: 'family-1',
    members: [],
    hasPayment,
    hasSubscription,
    parentEmail: 'parent@example.com',
    parentPhone: '123-456-7890',
  })

  it('should return all families for "overview" tab', () => {
    const families = [createFamily(true, true), createFamily(false, false)]
    const result = filterFamiliesByTab(families, 'overview')
    expect(result).toEqual(families)
  })

  it('should return only active families for "active" tab', () => {
    const families = [
      createFamily(true, true),
      createFamily(false, false),
      createFamily(true, false),
    ]
    const result = filterFamiliesByTab(families, 'active')
    expect(result).toHaveLength(1)
    expect(result[0].hasSubscription).toBe(true)
  })

  it('should return only pending families for "pending" tab', () => {
    const families = [
      createFamily(true, true),
      createFamily(true, false),
      createFamily(false, false),
    ]
    const result = filterFamiliesByTab(families, 'pending')
    expect(result).toHaveLength(1)
    expect(result[0].hasPayment).toBe(true)
    expect(result[0].hasSubscription).toBe(false)
  })

  it('should return only families needing attention for "needs-attention" tab', () => {
    const families = [
      createFamily(true, true),
      createFamily(false, false),
      createFamily(true, false),
    ]
    const result = filterFamiliesByTab(families, 'needs-attention')
    expect(result).toHaveLength(1)
    expect(result[0].hasPayment).toBe(false)
  })

  it('should return all families for "all" tab', () => {
    const families = [createFamily(true, true), createFamily(false, false)]
    const result = filterFamiliesByTab(families, 'all')
    expect(result).toEqual(families)
  })
})

describe('applyAllFilters', () => {
  const createFamily = (
    member: Partial<Family['members'][0]>,
    hasPayment = false,
    hasSubscription = false
  ): Family => ({
    familyKey: 'family-1',
    members: [
      {
        id: 'id-1',
        name: member.name || 'Test Child',
        parentEmail: member.parentEmail || 'parent@example.com',
        createdAt: member.createdAt || new Date(),
        schoolName: member.schoolName || 'School A',
      } as Family['members'][0],
    ],
    hasPayment,
    hasSubscription,
    parentEmail: 'parent@example.com',
    parentPhone: '123-456-7890',
  })

  it('should apply tab filter', () => {
    const families = [
      createFamily({}, true, true),
      createFamily({}, false, false),
    ]
    const result = applyAllFilters(families, { tab: 'active' })
    expect(result).toHaveLength(1)
    expect(result[0].hasSubscription).toBe(true)
  })

  it('should apply search query filter', () => {
    const families = [
      createFamily({ name: 'John Doe' }),
      createFamily({ name: 'Jane Smith' }),
    ]
    const result = applyAllFilters(families, { searchQuery: 'john' })
    expect(result).toHaveLength(1)
    expect(result[0].members[0].name).toBe('John Doe')
  })

  it('should apply advanced filters', () => {
    const families = [
      createFamily({ schoolName: 'School A' }),
      createFamily({ schoolName: 'School B' }),
    ]
    const filters: FamilyFilters = {
      dateRange: null,
      schools: ['School A'],
      grades: [],
      hasHealthInfo: false,
    }
    const result = applyAllFilters(families, { advancedFilters: filters })
    expect(result).toHaveLength(1)
    expect(result[0].members[0].schoolName).toBe('School A')
  })

  it('should apply all filters together', () => {
    const families = [
      createFamily({ name: 'John Doe', schoolName: 'School A' }, true, false),
      createFamily(
        { name: 'Jane Smith', schoolName: 'School A' },
        false,
        false
      ),
    ]
    const filters: FamilyFilters = {
      dateRange: null,
      schools: ['School A'],
      grades: [],
      hasHealthInfo: false,
    }
    const result = applyAllFilters(families, {
      tab: 'pending',
      searchQuery: 'john',
      advancedFilters: filters,
    })
    expect(result).toHaveLength(1)
    expect(result[0].members[0].name).toBe('John Doe')
    expect(result[0].hasPayment).toBe(true)
  })

  it('should return all families when no filters provided', () => {
    const families = [createFamily({})]
    const result = applyAllFilters(families, {})
    expect(result).toEqual(families)
  })
})
