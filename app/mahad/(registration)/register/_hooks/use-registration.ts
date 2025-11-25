import { useState, useCallback, useRef, useEffect } from 'react'

import { UseFormReturn } from 'react-hook-form'
import { toast } from 'sonner'

import { createClientLogger } from '@/lib/logger-client'
import {
  MahadRegistrationValues as StudentFormValues,
  type SearchResult,
} from '@/lib/registration/schemas/registration'
import { ExistingPersonData } from '@/lib/types/registration-errors'

import { registerStudent as registerStudentAction } from '../_actions'

const logger = createClientLogger('useRegistration')

interface UseRegistrationProps {
  form: UseFormReturn<StudentFormValues>
  onSuccess: (studentCount: number) => void
  onDuplicate?: (
    duplicateField?: 'email' | 'phone' | 'both',
    personData?: ExistingPersonData
  ) => void
}

export function useRegistration({
  form,
  onSuccess,
  onDuplicate,
}: UseRegistrationProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Use ref to store onSuccess callback to prevent recreating registerStudent on every render
  const onSuccessRef = useRef(onSuccess)
  const onDuplicateRef = useRef(onDuplicate)

  // Keep refs up to date with latest callbacks
  useEffect(() => {
    onSuccessRef.current = onSuccess
  }, [onSuccess])

  useEffect(() => {
    onDuplicateRef.current = onDuplicate
  }, [onDuplicate])

  const registerStudent = useCallback(
    async (formData: StudentFormValues, siblings: SearchResult[]) => {
      if (isSubmitting) return

      setIsSubmitting(true)

      const registrationPromise = registerStudentAction({
        studentData: formData,
        siblingIds: siblings.length > 0 ? siblings.map((s) => s.id) : null,
      })

      try {
        const result = await registrationPromise

        if (!result.success) {
          // Check if this is a duplicate registration error
          const isDuplicateError =
            result.error?.includes('already registered') || false
          let duplicateField: 'email' | 'phone' | 'both' | undefined

          if (isDuplicateError) {
            // Determine duplicate field from result
            if (result.fields && result.fields.length > 0) {
              // Both email and phone are duplicates
              if (
                result.fields.includes('email') &&
                result.fields.includes('phone')
              ) {
                duplicateField = 'both'
              } else if (result.fields.includes('email')) {
                duplicateField = 'email'
              } else if (result.fields.includes('phone')) {
                duplicateField = 'phone'
              }
            } else if (result.field) {
              duplicateField =
                result.field === 'email' || result.field === 'phone'
                  ? result.field
                  : undefined
            }

            // Call onDuplicate callback if provided
            if (onDuplicateRef.current && duplicateField) {
              onDuplicateRef.current(duplicateField, result.existingPerson)
            }
          }

          // If error has multiple fields (e.g., both email and phone are duplicates), show on both
          if (result.fields && result.fields.length > 0) {
            result.fields.forEach((field) => {
              form.setError(field, {
                type: 'manual',
                message: result.error,
              })
            })
            // Show generic toast to avoid duplication with field errors
            toast.error('Please check the form for errors')
          } else if (result.field) {
            // If error has a specific field, show it under that field
            form.setError(result.field, {
              type: 'manual',
              message: result.error,
            })
            // Show generic toast to avoid duplication with field error
            toast.error('Please check the form for errors')
          } else {
            // General error, show detailed toast
            toast.error(
              result.error || 'Registration failed. Please try again.'
            )
          }
          return
        }

        // Build success message based on sibling counts
        const totalEnrolled = 1 + (result.siblingsAdded || 0)
        const successMessage =
          totalEnrolled > 1
            ? `Registration complete! Successfully enrolled ${totalEnrolled} ${totalEnrolled === 1 ? 'student' : 'students'}.`
            : 'Registration complete! Successfully enrolled 1 student.'

        toast.success(successMessage)

        // If some siblings failed, show warning
        if (result.siblingsFailed && result.siblingsFailed > 0) {
          toast.warning(
            `Note: ${result.siblingsFailed} sibling ${result.siblingsFailed === 1 ? 'relationship' : 'relationships'} could not be added. They may already be linked.`
          )
        }

        form.reset()
        // Use ref to call onSuccess to prevent dependency issues
        onSuccessRef.current(totalEnrolled)
      } catch (error) {
        logger.error('Registration error', error)
        toast.error(
          error instanceof Error
            ? error.message
            : 'Registration failed. Please try again.'
        )
      } finally {
        setIsSubmitting(false)
      }
    },
    [isSubmitting, form]
  )

  return {
    registerStudent,
    isSubmitting,
  }
}
