export function countPresentStudents(records: { status: string }[]): number {
  return records.filter((r) => r.status === 'PRESENT' || r.status === 'LATE')
    .length
}

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

export function rateFromStatusCounts(
  statusCounts: { status: string; _count: { status: number } }[]
): { rate: number; total: number } {
  const counts = aggregateStatusCounts(statusCounts)
  const total =
    (counts['PRESENT'] ?? 0) +
    (counts['ABSENT'] ?? 0) +
    (counts['LATE'] ?? 0) +
    (counts['EXCUSED'] ?? 0)
  return {
    rate: computeAttendanceRate(
      counts['PRESENT'] ?? 0,
      counts['LATE'] ?? 0,
      total
    ),
    total,
  }
}
