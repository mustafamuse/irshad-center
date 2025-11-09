/**
 * Name formatting utilities for Dugsi admin
 * Handles splitting and combining names for consistency with registration forms
 */

/**
 * Split a full name into firstName and lastName.
 * Handles edge cases like single names, empty names, and multiple words.
 *
 * @param fullName - Full name string (e.g., "John Doe" or "Mary Jane Smith")
 * @returns Object with firstName and lastName
 *
 * @example
 * splitFullName("") // { firstName: "", lastName: "" }
 */
export function splitFullName(fullName: string): {
  firstName: string
  lastName: string
} {
  if (!fullName || !fullName.trim()) {
    return { firstName: '', lastName: '' }
  }

  const trimmed = fullName.trim()
  const parts = trimmed.split(/\s+/)

  if (parts.length === 0) {
    return { firstName: '', lastName: '' }
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' }
  }

  // First word is firstName, rest is lastName
  const firstName = parts[0]
  const lastName = parts.slice(1).join(' ')

  return { firstName, lastName }
}
