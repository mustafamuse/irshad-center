import { useEffect } from 'react'

import { UseFormReturn } from 'react-hook-form'

const STORAGE_KEY = 'scholarship-draft'
const AUTO_SAVE_DELAY = 1000 // 1 second debounce

/**
 * Auto-save form data to localStorage
 * Restores draft on mount, saves on changes
 */
export function useFormPersistence<T extends Record<string, unknown>>(
  form: UseFormReturn<T>
) {
  // Restore draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const draft = JSON.parse(saved)
        form.reset(draft)
      }
    } catch (error) {
      console.error('Failed to restore draft:', error)
      // Clear corrupted data
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [form])

  // Auto-save on changes (debounced)
  useEffect(() => {
    let timeoutId: NodeJS.Timeout

    const subscription = form.watch((data) => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
        } catch (error) {
          console.error('Failed to save draft:', error)
        }
      }, AUTO_SAVE_DELAY)
    })

    return () => {
      clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  }, [form])

  // Clear draft function
  const clearDraft = () => {
    localStorage.removeItem(STORAGE_KEY)
  }

  return { clearDraft }
}
