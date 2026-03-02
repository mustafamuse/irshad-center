import { z } from 'zod'

export const MIN_DONATION_CENTS = 100
export const MAX_DONATION_CENTS = 10_000_000

export const DonationCheckoutSchema = z.object({
  amount: z
    .number()
    .int('Amount must be a whole number')
    .min(MIN_DONATION_CENTS, 'Minimum donation is $1')
    .max(MAX_DONATION_CENTS, 'Maximum donation is $100,000'),
  mode: z.enum(['payment', 'subscription'], {
    errorMap: () => ({ message: 'Mode must be "payment" or "subscription"' }),
  }),
  donorEmail: z.string().email('Invalid email').optional(),
})

export type DonationCheckoutInput = z.infer<typeof DonationCheckoutSchema>
