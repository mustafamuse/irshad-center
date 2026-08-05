/**
 * Contact masking for the public success page. The page is unauthenticated,
 * so full parent emails/phones and child dates of birth must never reach
 * the client payload — they are scrapeable and were usable to satisfy the
 * guardian-continuity check in registration (see PR 264 security review).
 *
 * Masked forms keep just enough signal for a parent to recognize their own
 * entry and for search-by-own-contact to keep working: the search box masks
 * the query with the same functions and compares masked-to-masked.
 */

export function maskEmail(email: string | null): string | null {
  if (!email) return null
  const trimmed = email.trim().toLowerCase()
  const atIndex = trimmed.indexOf('@')
  if (atIndex <= 0) return null
  return `${trimmed[0]}•••${trimmed.slice(atIndex)}`
}

export function maskPhone(phone: string | null): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 4) return null
  return `•••-•••-${digits.slice(-4)}`
}
