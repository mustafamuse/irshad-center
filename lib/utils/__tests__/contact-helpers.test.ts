import { ContactPoint } from '@prisma/client'
import { describe, it, expect } from 'vitest'

import { extractContactInfo } from '../contact-helpers'

describe('extractContactInfo', () => {
  it('should extract email and phone from contact points', () => {
    const contactPoints: ContactPoint[] = [
      {
        id: '1',
        personId: 'person-1',
        type: 'EMAIL',
        value: 'test@example.com',
        isPrimary: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '2',
        personId: 'person-1',
        type: 'PHONE',
        value: '+1234567890',
        isPrimary: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]

    const result = extractContactInfo(contactPoints)

    expect(result).toEqual({
      email: 'test@example.com',
      phone: '+1234567890',
    })
  })

  it('should extract WhatsApp as phone', () => {
    const contactPoints: ContactPoint[] = [
      {
        id: '1',
        personId: 'person-1',
        type: 'WHATSAPP',
        value: '+9876543210',
        isPrimary: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]

    const result = extractContactInfo(contactPoints)

    expect(result).toEqual({
      email: null,
      phone: '+9876543210',
    })
  })

  it('should return null for missing email', () => {
    const contactPoints: ContactPoint[] = [
      {
        id: '1',
        personId: 'person-1',
        type: 'PHONE',
        value: '+1234567890',
        isPrimary: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]

    const result = extractContactInfo(contactPoints)

    expect(result).toEqual({
      email: null,
      phone: '+1234567890',
    })
  })

  it('should return null for missing phone', () => {
    const contactPoints: ContactPoint[] = [
      {
        id: '1',
        personId: 'person-1',
        type: 'EMAIL',
        value: 'test@example.com',
        isPrimary: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
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
      {
        id: '1',
        personId: 'person-1',
        type: 'WHATSAPP',
        value: '+9876543210',
        isPrimary: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '2',
        personId: 'person-1',
        type: 'PHONE',
        value: '+1234567890',
        isPrimary: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]

    const result = extractContactInfo(contactPoints)

    expect(result.phone).toBe('+9876543210')
  })
})
