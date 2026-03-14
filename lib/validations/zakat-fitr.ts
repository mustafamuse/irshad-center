import { z } from 'zod'

export const ZAKAT_FITR_PER_PERSON_CENTS = 1300
export const MAX_FAMILY_SIZE = 15

export const ZakatFitrCheckoutSchema = z.object({
  numberOfPeople: z
    .number()
    .int('Number of people must be a whole number')
    .min(1, 'At least 1 person is required')
    .max(MAX_FAMILY_SIZE, `Maximum family size is ${MAX_FAMILY_SIZE}`),
  donorEmail: z.string().email('Invalid email').optional(),
})

export type ZakatFitrCheckoutInput = z.infer<typeof ZakatFitrCheckoutSchema>

export function calculateStripeFee(baseCents: number): {
  baseCents: number
  feeCents: number
  totalCents: number
} {
  const totalCents = Math.ceil((baseCents + 30) / (1 - 0.029))
  const feeCents = totalCents - baseCents
  return { baseCents, feeCents, totalCents }
}
