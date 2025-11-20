/**
 * Escape HTML special characters to prevent XSS attacks
 * Use this when inserting user input into HTML strings
 *
 * @param unsafe - Untrusted user input
 * @returns HTML-safe escaped string
 *
 * @example
 * escapeHtml('<script>alert("XSS")</script>')
 * // Returns: '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
 *
 * escapeHtml("O'Brien & Associates")
 * // Returns: 'O&#039;Brien &amp; Associates'
 */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
