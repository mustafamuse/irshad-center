import { useCallback, useRef, useState } from 'react'

import { Path, UseFormReturn } from 'react-hook-form'

import { checkParentEmailExists } from '@/app/dugsi/register/actions'
import { checkEmailExists } from '@/app/mahad/(registration)/register/_actions'

type RegistrationValues = {
  email?: string
  parentEmail?: string
  [key: string]: unknown
}

interface UseEmailValidationOptions {
  isParentRegistration?: boolean
  debounceMs?: number
}

export function useEmailValidation<T extends RegistrationValues>(
  form: UseFormReturn<T>,
  options: UseEmailValidationOptions = {}
) {
  const [isCheckingEmail, setIsCheckingEmail] = useState(false)
  const { isParentRegistration = false, debounceMs = 500 } = options
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  const validateEmailImmediate = useCallback(
    async (email: string): Promise<boolean> => {
      if (!email) return true

      setIsCheckingEmail(true)
      try {
        const exists = isParentRegistration
          ? await checkParentEmailExists(email)
          : await checkEmailExists(email)

        if (exists) {
          const message = isParentRegistration
            ? 'This parent email is already registered'
            : 'This email is already registered'

          const fieldName = (
            isParentRegistration ? 'parentEmail' : 'email'
          ) as Path<T>

          form.setError(fieldName, {
            type: 'manual',
            message,
          })
          return false
        }

        const fieldName = (
          isParentRegistration ? 'parentEmail' : 'email'
        ) as Path<T>
        form.clearErrors(fieldName)
        return true
      } catch (error) {
        console.error('Error checking email:', error)
        return true // Allow submission on error, we'll catch it server-side
      } finally {
        setIsCheckingEmail(false)
      }
    },
    [isParentRegistration, form]
  )

  const validateEmail = useCallback(
    async (email: string): Promise<boolean> => {
      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      // For immediate validation (e.g., on form submit), skip debounce
      if (debounceMs === 0) {
        return validateEmailImmediate(email)
      }

      // Set loading state immediately for UX feedback
      setIsCheckingEmail(true)

      // Create promise that resolves after debounce
      return new Promise((resolve) => {
        debounceTimerRef.current = setTimeout(async () => {
          const result = await validateEmailImmediate(email)
          resolve(result)
        }, debounceMs)
      })
    },
    [debounceMs, validateEmailImmediate]
  )

  return {
    validateEmail,
    validateEmailImmediate, // Expose immediate version for form submit
    isCheckingEmail,
  }
}
