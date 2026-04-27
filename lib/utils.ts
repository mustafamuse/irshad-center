import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isValidDate(dateString: string | undefined | null): boolean {
  if (!dateString || typeof dateString !== 'string') {
    return false
  }

  const date = new Date(dateString)
  return !isNaN(date.getTime()) && dateString.trim() !== ''
}

export function capitalizeName(str: string): string {
  if (!str) return ''

  const normalized = str.replace(/[\u2019\u02BC]/g, "'")

  return normalized
    .toLowerCase()
    .split(/(\s|-|')/)
    .map((word) => {
      if (word === ' ' || word === '-' || word === "'") {
        return word
      }
      if (word.length > 0) {
        return word.charAt(0).toUpperCase() + word.slice(1)
      }
      return word
    })
    .join('')
}
