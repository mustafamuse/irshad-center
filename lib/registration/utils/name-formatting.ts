/**
 * Capitalizes a name string properly (handles multi-word names)
 * Examples:
 * - "john" → "John"
 * - "mary jane" → "Mary Jane"
 * - "o'brien" → "O'Brien"
 * - "mc-donald" → "Mc-Donald"
 */
export function capitalizeName(name: string): string {
  return name
    .trim()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

/**
 * Formats first and last name into a full name with proper capitalization
 */
export function formatFullName(firstName: string, lastName: string): string {
  const capitalizedFirst = capitalizeName(firstName)
  const capitalizedLast = capitalizeName(lastName)
  return `${capitalizedFirst} ${capitalizedLast}`.trim()
}

/**
 * Returns both capitalized first and last names as an object
 */
export function capitalizeNames(
  firstName: string,
  lastName: string
): { firstName: string; lastName: string } {
  return {
    firstName: capitalizeName(firstName),
    lastName: capitalizeName(lastName),
  }
}
