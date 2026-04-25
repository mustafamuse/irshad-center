/** Academic year runs September through August. */
export function getAcademicYear(): string {
  const now = new Date()
  const year = now.getFullYear()
  const startYear = now.getMonth() >= 8 ? year : year - 1
  return `${startYear}-${startYear + 1}`
}
