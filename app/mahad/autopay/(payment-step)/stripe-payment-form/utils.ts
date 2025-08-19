import { toast } from 'sonner'

import { FormStatus } from './types'

interface ToastMessages {
  success?: string
  error?: string
  info?: string
  description?: string
}

const STATUS_MESSAGES: Record<FormStatus, ToastMessages> = {
  initial: {},
  requires_payment_method: {
    error: 'Bank account verification failed',
    description: 'Please try again with valid bank details.',
  },
  requires_confirmation: {},
  requires_action: {
    info: 'Micro-deposits initiated',
    description: 'Two small deposits will be sent to your bank account.',
  },
  processing: {
    success:
      'Bank account setup complete! Your subscription is being processed.',
  },
  succeeded: {
    success: 'Enrollment completed successfully! 🎉',
  },
  canceled: {},
}

export function showStatusToast(status: FormStatus) {
  const messages = STATUS_MESSAGES[status]

  if (messages.success) toast.success(messages.success)
  if (messages.error)
    toast.error(messages.error, { description: messages.description })
  if (messages.info)
    toast.info(messages.info, { description: messages.description })
}

export function showErrorToast(error: Error) {
  toast.error('An error occurred', {
    description: error.message || 'Please try again or contact support.',
  })
}
