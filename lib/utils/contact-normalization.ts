import { ContactType } from '@prisma/client'

import { normalizePhone } from '@/lib/types/person'

export { normalizePhone }

export function normalizeEmail(
  email: string | null | undefined
): string | null {
  if (!email) return null
  return email.toLowerCase().trim()
}

export function normalizeContact(
  value: string | null | undefined,
  type: ContactType
): string | null {
  if (!value) return null

  switch (type) {
    case 'EMAIL':
      return normalizeEmail(value)
    case 'PHONE':
      return normalizePhone(value)
    default:
      return value.trim() || null
  }
}

export function validateAndNormalizeEmail(
  email: string | null | undefined
): string | null {
  if (!email) return null

  const normalized = normalizeEmail(email)
  if (!normalized) return null

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(normalized) ? normalized : null
}
