// Academic year runs September–August. Returns e.g. "2025-2026".
export function getAcademicYear(): string {
  const now = new Date()
  const year = now.getFullYear()
  const startYear = now.getMonth() >= 8 ? year : year - 1
  return `${startYear}-${startYear + 1}`
}
