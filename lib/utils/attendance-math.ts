export function sortByFamilyThenName<
  T extends { familyReferenceId: string | null; name: string },
>(items: T[]): T[] {
  return items.toSorted((a, b) => {
    if (a.familyReferenceId && b.familyReferenceId) {
      if (a.familyReferenceId === b.familyReferenceId)
        return a.name.localeCompare(b.name)
      return a.familyReferenceId.localeCompare(b.familyReferenceId)
    }
    if (a.familyReferenceId) return -1
    if (b.familyReferenceId) return 1
    return a.name.localeCompare(b.name)
  })
}

export function aggregateStatusCounts(
  statusCounts: { status: string; _count: { status: number } }[]
): Record<string, number> {
  return Object.fromEntries(
    statusCounts.map((s) => [s.status, s._count.status])
  )
}

export function computeAttendanceRate(
  present: number,
  late: number,
  total: number
): number {
  if (total === 0) return 0
  return ((present + late) / total) * 100
}
