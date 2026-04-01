/**
 * Format phone for pre-populating editable form fields.
 * - E.164 US (+1XXXXXXXXXX) → XXX-XXX-XXXX (matches US form input)
 * - E.164 international → returned as-is (form accepts + prefix)
 * - Legacy 10-digit US → XXX-XXX-XXXX
 */
export function formatPhoneForDisplay(
  phone: string | null | undefined
): string {
  if (!phone) return ''
  const trimmed = phone.trim()

  // Already in US form format
  if (/^\d{3}-\d{3}-\d{4}$/.test(trimmed)) return trimmed

  // E.164 US (+1XXXXXXXXXX) → strip country code for US form format
  const e164UsMatch = trimmed.match(/^\+1(\d{10})$/)
  if (e164UsMatch) {
    const d = e164UsMatch[1]
    return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
  }

  // Other E.164 (international) → return as-is
  if (trimmed.startsWith('+')) return trimmed

  // Legacy 10-digit US (pre-migration)
  if (/^\d{10}$/.test(trimmed)) {
    return `${trimmed.slice(0, 3)}-${trimmed.slice(3, 6)}-${trimmed.slice(6)}`
  }

  return phone
}
