import { useRouter } from 'next/navigation'

import { useAction } from 'next-safe-action/hooks'
import { UseFormReturn } from 'react-hook-form'
import { toast } from 'sonner'

import type { MahadRegistrationValues } from '@/lib/registration/schemas/mahad-registration'
import { applySafeActionValidationErrorsToForm } from '@/lib/registration/utils/apply-safe-action-validation-to-rhf'

import { registerStudent as registerStudentAction } from '../_actions'

export function useRegistration({
  form,
}: {
  form: UseFormReturn<MahadRegistrationValues>
}) {
  const router = useRouter()

  const { execute, isPending } = useAction(registerStudentAction, {
    onSuccess: ({ data }) => {
      if (!data) return
      toast.success('Registration complete!')
      form.reset()
      router.push(
        `/mahad/register/success?name=${encodeURIComponent(data.name)}`
      )
    },
    onError: ({ error }) => {
      if (error.validationErrors) {
        applySafeActionValidationErrorsToForm(form, error.validationErrors)
        toast.error('Please correct the errors above.')
        return
      }
      if (error.serverError) {
        toast.error(error.serverError)
        return
      }
      toast.error('Registration failed. Please try again.')
    },
  })

  function registerStudent(values: MahadRegistrationValues) {
    execute(values)
  }

  return {
    registerStudent,
    isSubmitting: isPending,
  }
}
