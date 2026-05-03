// Phone number formatting function
export function formatPhoneNumber(value: string): string {
  const cleaned = value.replace(/\D/g, '')

  if (cleaned.length <= 3) return cleaned
  if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`
  if (cleaned.length <= 10)
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`

  // Truncate to 10 digits
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`
}

// Debounce utility
export function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

// Common form input class names
export const inputClassNames = {
  base: 'h-14 rounded-lg px-4 text-base md:h-12',
  error: 'border-destructive focus-visible:ring-destructive',
  withIcon: 'pr-12',
}

// Helper to get combined input class names
export function getInputClassNames(hasError: boolean, hasIcon = false): string {
  return [
    inputClassNames.base,
    hasError ? inputClassNames.error : '',
    hasIcon ? inputClassNames.withIcon : '',
  ]
    .filter(Boolean)
    .join(' ')
}
