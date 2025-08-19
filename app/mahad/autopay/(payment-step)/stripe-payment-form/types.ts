export interface StripePaymentFormProps {
  clientSecret: string
  payorDetails: {
    email: string
    name: string
    phone: string
  }
  className?: string
  studentIds: string[]
}

export type FormStatus =
  | 'initial'
  | 'requires_payment_method'
  | 'requires_confirmation'
  | 'requires_action'
  | 'processing'
  | 'succeeded'
  | 'canceled'
