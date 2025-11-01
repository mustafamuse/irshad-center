/**
 * Date Grouping Utilities
 * Groups registrations by date categories for better organization
 */

import { DugsiRegistration } from '../_types'

export type DateGroup =
  | 'Today'
  | 'Yesterday'
  | 'This Week'
  | 'Last Week'
  | 'This Month'
  | 'Last Month'
  | 'Older'

export interface GroupedRegistrations {
  group: DateGroup
  registrations: DugsiRegistration[]
  count: number
}

/**
 * Determines which date group a registration belongs to
 */
export function getDateGroup(date: Date | string): DateGroup {
  const regDate = new Date(date)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  // Start of this week (Sunday)
  const startOfThisWeek = new Date(today)
  startOfThisWeek.setDate(today.getDate() - today.getDay())

  // Start of last week
  const startOfLastWeek = new Date(startOfThisWeek)
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7)

  // Start of this month
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  // Start of last month
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  // Determine group
  if (regDate >= today) {
    return 'Today'
  } else if (regDate >= yesterday && regDate < today) {
    return 'Yesterday'
  } else if (regDate >= startOfThisWeek) {
    return 'This Week'
  } else if (regDate >= startOfLastWeek && regDate < startOfThisWeek) {
    return 'Last Week'
  } else if (regDate >= startOfThisMonth) {
    return 'This Month'
  } else if (regDate >= startOfLastMonth && regDate < startOfThisMonth) {
    return 'Last Month'
  } else {
    return 'Older'
  }
}

/**
 * Groups registrations by date categories
 */
export function groupRegistrationsByDate(
  registrations: DugsiRegistration[]
): GroupedRegistrations[] {
  // Group registrations
  const groups: Map<DateGroup, DugsiRegistration[]> = new Map()

  for (const registration of registrations) {
    const group = getDateGroup(registration.createdAt)
    if (!groups.has(group)) {
      groups.set(group, [])
    }
    groups.get(group)!.push(registration)
  }

  // Define order of groups
  const groupOrder: DateGroup[] = [
    'Today',
    'Yesterday',
    'This Week',
    'Last Week',
    'This Month',
    'Last Month',
    'Older',
  ]

  // Convert to array and sort by group order
  const result: GroupedRegistrations[] = []
  for (const group of groupOrder) {
    const registrations = groups.get(group)
    if (registrations && registrations.length > 0) {
      // Sort registrations within each group by date (newest first)
      registrations.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      result.push({
        group,
        registrations,
        count: registrations.length,
      })
    }
  }

  return result
}
