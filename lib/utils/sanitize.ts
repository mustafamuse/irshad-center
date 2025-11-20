/**
 * Sanitize a string for use in filenames
 * Removes special characters and limits length for security
 *
 * @param input - Unsanitized string (e.g., user input)
 * @param maxLength - Maximum filename length (default: 100)
 * @returns Sanitized string safe for use in filenames
 *
 * @example
 * sanitizeFilename('../../../etc/passwd') // 'etcpasswd'
 */
export function sanitizeFilename(
  input: string,
  maxLength: number = 100
): string {
  return (
    input
      .toLowerCase()
      .trim()
      // Remove all special characters except spaces and hyphens
      .replace(/[^a-z0-9\s-]/g, '')
      // Replace multiple spaces/hyphens with single hyphen
      .replace(/[\s-]+/g, '-')
      // Remove leading/trailing hyphens
      .replace(/^-+|-+$/g, '')
      // Limit length
      .slice(0, maxLength) || 'untitled'
  ) // Fallback if everything was removed
}
