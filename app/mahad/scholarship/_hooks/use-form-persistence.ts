import { useEffect } from 'react'

import { UseFormReturn } from 'react-hook-form'
import { toast } from 'sonner'
import { ZodSchema } from 'zod'

const STORAGE_KEY = 'scholarship-draft'
const AUTO_SAVE_DELAY = 1000 // 1 second debounce

interface UseFormPersistenceOptions<T> {
  schema?: ZodSchema<T>
}

/**
 * Auto-save form data to localStorage with validation
 * Restores and validates draft on mount, saves changes with debounce
 *
 * @param form - React Hook Form instance
 * @param options - Optional schema for validating restored drafts
 * @returns Object with clearDraft function
 *
 * @example
 * const { clearDraft } = useFormPersistence(methods, {
 *   schema: scholarshipApplicationSchema.partial()
 * })
 */
export function useFormPersistence<T extends Record<string, unknown>>(
  form: UseFormReturn<T>,
  options?: UseFormPersistenceOptions<Partial<T>>
) {
  // Restore draft on mount with validation
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const draft = JSON.parse(saved)

        // Validate draft if schema provided
        if (options?.schema) {
          const validation = options.schema.safeParse(draft)
          if (validation.success) {
            form.reset(validation.data as T)
          } else {
            console.warn('Saved draft failed validation, clearing...')
            localStorage.removeItem(STORAGE_KEY)
          }
        } else {
          // No schema - restore without validation (less safe)
          form.reset(draft)
        }
      }
    } catch (error) {
      console.error('Failed to restore draft:', error)
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [form, options?.schema])

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
          // Handle quota exceeded - notify user
          if (error instanceof Error && error.name === 'QuotaExceededError') {
            toast.warning('Auto-save disabled', {
              description:
                'Browser storage is full. Please submit soon or clear browser data.',
              duration: 8000,
            })
          }
        }
      }, AUTO_SAVE_DELAY)
    })

    return () => {
      clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  }, [form])

  /**
   * Clear saved draft from localStorage
   * Call this after successful form submission
   */
  const clearDraft = () => {
    localStorage.removeItem(STORAGE_KEY)
  }

  return { clearDraft }
}
