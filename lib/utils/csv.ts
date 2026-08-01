const FORMULA_CHARS = /^[=+\-@\t\r]/

/**
 * Escape a single CSV cell value.
 * Prefixes formula-injection characters with a quote (Excel/Sheets convention)
 * and wraps in quotes when the value contains a comma, quote, or newline.
 */
export function csvCell(value: string | null | undefined): string {
  let s = value ?? ''
  if (FORMULA_CHARS.test(s)) s = "'" + s
  if (
    s.includes(',') ||
    s.includes('"') ||
    s.includes('\n') ||
    s.includes('\r')
  ) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}
