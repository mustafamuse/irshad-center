import { ContactPoint } from '@prisma/client'

export function extractContactInfo(contactPoints: ContactPoint[]) {
  const email = contactPoints.find((cp) => cp.type === 'EMAIL')?.value ?? null
  const phone =
    contactPoints.find((cp) => cp.type === 'PHONE' || cp.type === 'WHATSAPP')
      ?.value ?? null

  return { email, phone }
}
