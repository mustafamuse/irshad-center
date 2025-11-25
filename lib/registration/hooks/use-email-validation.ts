import { useCallback, useRef, useState } from 'react'

import { Path, UseFormReturn } from 'react-hook-form'

import { checkParentEmailExists } from '@/app/dugsi/register/actions'
import { checkDuplicateWithPersonData } from '@/app/mahad/(registration)/register/_actions'
import { ExistingPersonData } from '@/lib/types/registration-errors'

type Program = 'MAHAD_PROGRAM' | 'DUGSI_PROGRAM'

type RegistrationValues = {
  email?: string
  phone?: string
  parentEmail?: string
  [key: string]: unknown
}

interface UseEmailValidationOptions {
  isParentRegistration?: boolean
  debounceMs?: number
  program?: Program
}

interface ValidationResult {
  isValid: boolean
  personData?: ExistingPersonData
}

// In-memory cache with TTL
const emailCache = new Map<
  string,
  { exists: boolean; personData?: ExistingPersonData; timestamp: number }
>()
const phoneCache = new Map<
  string,
  { exists: boolean; personData?: ExistingPersonData; timestamp: number }
>()
const CACHE_TTL = 60000 // 60 seconds

export function useEmailValidation<T extends RegistrationValues>(
  form: UseFormReturn<T>,
  options: UseEmailValidationOptions = {}
) {
  const [isCheckingEmail, setIsCheckingEmail] = useState(false)
  const [isCheckingPhone, setIsCheckingPhone] = useState(false)
  const {
    isParentRegistration = false,
    debounceMs = 500,
    program = 'MAHAD_PROGRAM',
  } = options
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const phoneDebounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  const validateEmailImmediate = useCallback(
    async (email: string): Promise<ValidationResult> => {
      if (!email) return { isValid: true }

      const cacheKey = email.toLowerCase().trim()
      const now = Date.now()

      // Check cache first
      const cached = emailCache.get(cacheKey)
      if (cached && now - cached.timestamp < CACHE_TTL) {
        if (cached.exists) {
          const message = isParentRegistration
            ? 'This parent email is already registered'
            : 'This email address is already registered for the Mahad program'

          const fieldName = (
            isParentRegistration ? 'parentEmail' : 'email'
          ) as Path<T>

          form.setError(fieldName, {
            type: 'manual',
            message,
          })
          return { isValid: false, personData: cached.personData }
        }
        return { isValid: true }
      }

      setIsCheckingEmail(true)
      try {
        let exists = false
        let personData: ExistingPersonData | undefined

        if (isParentRegistration) {
          // Use legacy function for parent registration (Dugsi)
          exists = await checkParentEmailExists(email)
        } else {
          // Use server action for Mahad registration (safe for client-side)
          const result = await checkDuplicateWithPersonData({
            email,
            phone: null,
            program,
          })

          exists = result.isDuplicate
          personData = result.personData
        }

        // Update cache
        emailCache.set(cacheKey, { exists, personData, timestamp: now })

        if (exists) {
          const message = isParentRegistration
            ? 'This parent email is already registered'
            : 'This email address is already registered for the Mahad program'

          const fieldName = (
            isParentRegistration ? 'parentEmail' : 'email'
          ) as Path<T>

          form.setError(fieldName, {
            type: 'manual',
            message,
          })
          return { isValid: false, personData }
        }

        const fieldName = (
          isParentRegistration ? 'parentEmail' : 'email'
        ) as Path<T>
        form.clearErrors(fieldName)
        return { isValid: true }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error checking email:', error)
        return { isValid: true } // Allow submission on error, we'll catch it server-side
      } finally {
        setIsCheckingEmail(false)
      }
    },
    [isParentRegistration, form, program]
  )

  const validateEmail = useCallback(
    async (email: string): Promise<ValidationResult> => {
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

  const validatePhoneImmediate = useCallback(
    async (phone: string): Promise<ValidationResult> => {
      if (!phone) return { isValid: true }

      const cacheKey = phone.trim()
      const now = Date.now()

      // Check cache first
      const cached = phoneCache.get(cacheKey)
      if (cached && now - cached.timestamp < CACHE_TTL) {
        if (cached.exists) {
          form.setError('phone' as Path<T>, {
            type: 'manual',
            message:
              'This phone number is already registered for the Mahad program',
          })
          return { isValid: false, personData: cached.personData }
        }
        return { isValid: true }
      }

      setIsCheckingPhone(true)
      try {
        // Use server action for Mahad registration (safe for client-side)
        const result = await checkDuplicateWithPersonData({
          email: null,
          phone,
          program,
        })

        const exists = result.isDuplicate
        const personData = result.personData

        // Update cache
        phoneCache.set(cacheKey, { exists, personData, timestamp: now })

        if (exists) {
          form.setError('phone' as Path<T>, {
            type: 'manual',
            message:
              'This phone number is already registered for the Mahad program',
          })
          return { isValid: false, personData }
        }

        form.clearErrors('phone' as Path<T>)
        return { isValid: true }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error checking phone:', error)
        return { isValid: true } // Allow submission on error, we'll catch it server-side
      } finally {
        setIsCheckingPhone(false)
      }
    },
    [form, program]
  )

  const validatePhone = useCallback(
    async (phone: string): Promise<ValidationResult> => {
      // Clear existing timer
      if (phoneDebounceTimerRef.current) {
        clearTimeout(phoneDebounceTimerRef.current)
      }

      // For immediate validation (e.g., on form submit), skip debounce
      if (debounceMs === 0) {
        return validatePhoneImmediate(phone)
      }

      // Set loading state immediately for UX feedback
      setIsCheckingPhone(true)

      // Create promise that resolves after debounce
      return new Promise((resolve) => {
        phoneDebounceTimerRef.current = setTimeout(async () => {
          const result = await validatePhoneImmediate(phone)
          resolve(result)
        }, debounceMs)
      })
    },
    [debounceMs, validatePhoneImmediate]
  )

  return {
    validateEmail,
    validateEmailImmediate, // Expose immediate version for form submit
    isCheckingEmail,
    validatePhone,
    validatePhoneImmediate,
    isCheckingPhone,
  }
}
