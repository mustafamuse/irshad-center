import { ContactPoint, ContactType } from '@prisma/client'
import { describe, it, expect } from 'vitest'

import { extractContactInfo } from '../contact-helpers'

let idCounter = 0
function createContactPoint(
  type: ContactType,
  value: string,
  overrides: Partial<ContactPoint> = {}
): ContactPoint {
  return {
    id: `cp-${++idCounter}`,
    personId: 'person-1',
    type,
    value,
    isPrimary: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    verificationStatus: 'UNVERIFIED',
    verifiedAt: null,
    deactivatedAt: null,
    ...overrides,
  }
}

describe('extractContactInfo', () => {
  it('should extract email and phone from contact points', () => {
    const contactPoints: ContactPoint[] = [
      createContactPoint('EMAIL', 'test@example.com', { isPrimary: true }),
      createContactPoint('PHONE', '+1234567890'),
    ]

    const result = extractContactInfo(contactPoints)

    expect(result).toEqual({
      email: 'test@example.com',
      phone: '+1234567890',
    })
  })

  it('should extract WhatsApp as phone', () => {
    const contactPoints: ContactPoint[] = [
      createContactPoint('WHATSAPP', '+9876543210', { isPrimary: true }),
    ]

    const result = extractContactInfo(contactPoints)

    expect(result).toEqual({
      email: null,
      phone: '+9876543210',
    })
  })

  it('should return null for missing email', () => {
    const contactPoints: ContactPoint[] = [
      createContactPoint('PHONE', '+1234567890', { isPrimary: true }),
    ]

    const result = extractContactInfo(contactPoints)

    expect(result).toEqual({
      email: null,
      phone: '+1234567890',
    })
  })

  it('should return null for missing phone', () => {
    const contactPoints: ContactPoint[] = [
      createContactPoint('EMAIL', 'test@example.com', { isPrimary: true }),
    ]

    const result = extractContactInfo(contactPoints)

    expect(result).toEqual({
      email: 'test@example.com',
      phone: null,
    })
  })

  it('should return null for both when no contacts', () => {
    const result = extractContactInfo([])

    expect(result).toEqual({
      email: null,
      phone: null,
    })
  })

  it('should return first matching phone or WhatsApp', () => {
    const contactPoints: ContactPoint[] = [
      createContactPoint('WHATSAPP', '+9876543210'),
      createContactPoint('PHONE', '+1234567890', { isPrimary: true }),
    ]

    const result = extractContactInfo(contactPoints)

    expect(result.phone).toBe('+9876543210')
  })
})
