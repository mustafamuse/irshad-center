import { Gender } from '@prisma/client'

/**
 * Client-facing family shape for the public success page. Deliberately
 * carries NO raw PII: parent emails/phones are pre-masked server-side
 * (see _utils/mask.ts) and children expose a computed age, never the
 * date of birth.
 */
export interface Family {
  familyKey: string
  parent1Name: string | null
  parent1MaskedEmail: string | null
  parent1MaskedPhone: string | null
  parent2Name: string | null
  parent2MaskedEmail: string | null
  parent2MaskedPhone: string | null
  children: Array<{
    id: string
    name: string
    gradeLevel: string | null
    schoolName: string | null
    ageYears: number | null
    gender: Gender | null
    createdAt: Date
  }>
  registeredAt: Date
}
