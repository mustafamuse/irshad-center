import { normalizePhone } from '@/lib/types/person'

export { normalizePhone }

export function normalizeEmail(
  email: string | null | undefined
): string | null {
  if (!email) return null
  return email.toLowerCase().trim() || null
}

export function validateAndNormalizeEmail(
  email: string | null | undefined
): string | null {
  if (!email) return null

  const normalized = normalizeEmail(email)
  if (!normalized) return null

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(normalized) ? normalized : null
}
