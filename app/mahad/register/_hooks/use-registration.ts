import { useRouter } from 'next/navigation'

import { UseFormReturn } from 'react-hook-form'
import { toast } from 'sonner'

import { useSafeActionForm } from '@/app/mahad/_hooks/use-safe-action-form'
import type { MahadRegistrationValues } from '@/lib/registration/schemas/registration'

import { registerStudent as registerStudentAction } from '../_actions'

export function useRegistration({
  form,
}: {
  form: UseFormReturn<MahadRegistrationValues>
}) {
  const router = useRouter()

  const { execute, isPending } = useSafeActionForm<
    MahadRegistrationValues,
    { name: string }
  >({
    form,
    action: registerStudentAction,
    validationErrorToast: 'Please correct the errors above.',
    exceptionToast: 'Registration failed. Please try again.',
    loggerName: 'mahad-registration',
    onSuccess: (data) => {
      toast.success('Registration complete!')
      form.reset()
      router.push(
        `/mahad/register/success?name=${encodeURIComponent(data.name)}`
      )
    },
  })

  return {
    registerStudent: execute,
    isSubmitting: isPending,
  }
}
