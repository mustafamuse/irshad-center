/**
 * Registration Service Tests
 *
 * Tests for registration business logic.
 * Focus on data validation, normalization, and creation flows.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from '../utils/prisma-mock'
import { personFactory, programProfileFactory } from '../utils/factories'
import {
  createPersonWithContact,
  createProgramProfileWithEnrollment,
} from '@/lib/services/registration-service'

// Mock dependencies
vi.mock('@/lib/services/validation-service', () => ({
  validateEnrollment: vi.fn(),
}))

vi.mock('@/lib/db/queries/enrollment', () => ({
  createEnrollment: vi.fn(),
}))

vi.mock('@/lib/types/person', () => ({
  normalizePhone: (phone: string) => {
    if (!phone) return null
    const cleaned = phone.replace(/\D/g, '')
    return cleaned.length >= 10 ? cleaned : null
  },
}))

import { validateEnrollment } from '@/lib/services/validation-service'

describe('RegistrationService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createPersonWithContact - validation and normalization', () => {
    it('should validate required name field', async () => {
      await expect(
        createPersonWithContact({
          name: '',
          email: 'test@example.com',
        })
      ).rejects.toThrow('Name is required')
    })

    it('should validate name length', async () => {
      const longName = 'a'.repeat(256)

      await expect(
        createPersonWithContact({
          name: longName,
          email: 'test@example.com',
        })
      ).rejects.toThrow('Name is too long')
    })

    it('should validate email format', async () => {
      await expect(
        createPersonWithContact({
          name: 'John Doe',
          email: 'invalid-email',
        })
      ).rejects.toThrow('Invalid email format')
    })

    it('should normalize email to lowercase', async () => {
      const person = personFactory()
      prismaMock.person.create.mockResolvedValue({
        ...person,
        contactPoints: [],
      } as any)

      await createPersonWithContact({
        name: 'John Doe',
        email: 'JOHN@TEST.COM',
      })

      expect(prismaMock.person.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          contactPoints: {
            create: expect.arrayContaining([
              expect.objectContaining({
                type: 'EMAIL',
                value: 'john@test.com',
              }),
            ]),
          },
        }),
        include: { contactPoints: true },
      })
    })

    it('should validate phone format', async () => {
      await expect(
        createPersonWithContact({
          name: 'John Doe',
          phone: '123',
        })
      ).rejects.toThrow('Phone must be in format XXX-XXX-XXXX')
    })

    it('should accept valid phone formats', async () => {
      const person = personFactory()
      prismaMock.person.create.mockResolvedValue({
        ...person,
        contactPoints: [],
      } as any)

      // Test multiple valid formats
      const validPhones = [
        '123-456-7890',
        '(123) 456-7890',
        '1234567890',
        '+1-123-456-7890',
      ]

      for (const phone of validPhones) {
        vi.clearAllMocks()
        await createPersonWithContact({
          name: 'John Doe',
          phone,
        })
        expect(prismaMock.person.create).toHaveBeenCalled()
      }
    })

    it('should normalize phone number', async () => {
      const person = personFactory()
      prismaMock.person.create.mockResolvedValue({
        ...person,
        contactPoints: [],
      } as any)

      await createPersonWithContact({
        name: 'John Doe',
        phone: '(123) 456-7890',
      })

      expect(prismaMock.person.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          contactPoints: {
            create: expect.arrayContaining([
              expect.objectContaining({
                type: 'PHONE',
                value: '1234567890',
              }),
            ]),
          },
        }),
        include: { contactPoints: true },
      })
    })

    it('should validate dateOfBirth is in the past', async () => {
      const futureDate = new Date()
      futureDate.setFullYear(futureDate.getFullYear() + 1)

      await expect(
        createPersonWithContact({
          name: 'John Doe',
          dateOfBirth: futureDate,
        })
      ).rejects.toThrow('Date of birth must be in the past')
    })

    it('should accept valid dateOfBirth', async () => {
      const person = personFactory()
      const pastDate = new Date('2000-01-01')

      prismaMock.person.create.mockResolvedValue({
        ...person,
        contactPoints: [],
      } as any)

      await createPersonWithContact({
        name: 'John Doe',
        dateOfBirth: pastDate,
      })

      expect(prismaMock.person.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'John Doe',
          dateOfBirth: pastDate,
        }),
        include: { contactPoints: true },
      })
    })

    it('should create person with email only', async () => {
      const person = personFactory()
      prismaMock.person.create.mockResolvedValue({
        ...person,
        contactPoints: [],
      } as any)

      await createPersonWithContact({
        name: 'John Doe',
        email: 'john@test.com',
      })

      expect(prismaMock.person.create).toHaveBeenCalledWith({
        data: {
          name: 'John Doe',
          dateOfBirth: undefined,
          contactPoints: {
            create: [
              {
                type: 'EMAIL',
                value: 'john@test.com',
                isPrimary: true,
              },
            ],
          },
        },
        include: { contactPoints: true },
      })
    })

    it('should create person with phone only', async () => {
      const person = personFactory()
      prismaMock.person.create.mockResolvedValue({
        ...person,
        contactPoints: [],
      } as any)

      await createPersonWithContact({
        name: 'John Doe',
        phone: '123-456-7890',
      })

      expect(prismaMock.person.create).toHaveBeenCalledWith({
        data: {
          name: 'John Doe',
          dateOfBirth: undefined,
          contactPoints: {
            create: [
              {
                type: 'PHONE',
                value: '1234567890',
                isPrimary: true,
              },
            ],
          },
        },
        include: { contactPoints: true },
      })
    })

    it('should create person with both email and phone', async () => {
      const person = personFactory()
      prismaMock.person.create.mockResolvedValue({
        ...person,
        contactPoints: [],
      } as any)

      await createPersonWithContact({
        name: 'John Doe',
        email: 'john@test.com',
        phone: '123-456-7890',
      })

      expect(prismaMock.person.create).toHaveBeenCalledWith({
        data: {
          name: 'John Doe',
          dateOfBirth: undefined,
          contactPoints: {
            create: [
              {
                type: 'EMAIL',
                value: 'john@test.com',
                isPrimary: true,
              },
              {
                type: 'PHONE',
                value: '1234567890',
                isPrimary: true,
              },
            ],
          },
        },
        include: { contactPoints: true },
      })
    })

    it('should respect isPrimaryEmail flag', async () => {
      const person = personFactory()
      prismaMock.person.create.mockResolvedValue({
        ...person,
        contactPoints: [],
      } as any)

      await createPersonWithContact({
        name: 'John Doe',
        email: 'john@test.com',
        isPrimaryEmail: false,
      })

      expect(prismaMock.person.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          contactPoints: {
            create: expect.arrayContaining([
              expect.objectContaining({
                type: 'EMAIL',
                isPrimary: false,
              }),
            ]),
          },
        }),
        include: { contactPoints: true },
      })
    })

    it('should create person without contact points if none provided', async () => {
      const person = personFactory()
      prismaMock.person.create.mockResolvedValue({
        ...person,
        contactPoints: [],
      } as any)

      await createPersonWithContact({
        name: 'John Doe',
      })

      expect(prismaMock.person.create).toHaveBeenCalledWith({
        data: {
          name: 'John Doe',
          dateOfBirth: undefined,
          contactPoints: {
            create: [],
          },
        },
        include: { contactPoints: true },
      })
    })
  })

  describe('createProgramProfileWithEnrollment - validation', () => {
    it('should validate personId is UUID', async () => {
      await expect(
        createProgramProfileWithEnrollment({
          personId: 'invalid-uuid',
          program: 'MAHAD_PROGRAM',
        })
      ).rejects.toThrow('Person ID must be a valid UUID')
    })

    it('should validate monthlyRate is non-negative', async () => {
      await expect(
        createProgramProfileWithEnrollment({
          personId: '123e4567-e89b-12d3-a456-426614174000',
          program: 'MAHAD_PROGRAM',
          monthlyRate: -100,
        })
      ).rejects.toThrow('Monthly rate must be non-negative')
    })

    it('should validate monthlyRate maximum', async () => {
      await expect(
        createProgramProfileWithEnrollment({
          personId: '123e4567-e89b-12d3-a456-426614174000',
          program: 'MAHAD_PROGRAM',
          monthlyRate: 100001,
        })
      ).rejects.toThrow('Monthly rate is too large')
    })

    it('should validate monthlyRate is integer', async () => {
      await expect(
        createProgramProfileWithEnrollment({
          personId: '123e4567-e89b-12d3-a456-426614174000',
          program: 'MAHAD_PROGRAM',
          monthlyRate: 150.5,
        })
      ).rejects.toThrow('Monthly rate must be an integer')
    })

    it('should call validateEnrollment before creating profile', async () => {
      const profile = programProfileFactory()

      vi.mocked(validateEnrollment).mockResolvedValue(undefined)
      prismaMock.$transaction.mockImplementation(async (cb: any) => {
        return await cb(prismaMock)
      })
      prismaMock.programProfile.create.mockResolvedValue(profile as any)

      await createProgramProfileWithEnrollment({
        personId: '123e4567-e89b-12d3-a456-426614174000',
        program: 'DUGSI_PROGRAM',
        batchId: null,
      })

      expect(validateEnrollment).toHaveBeenCalledWith({
        program: 'DUGSI_PROGRAM',
        batchId: null,
        status: 'REGISTERED',
      })
    })

    it('should default status to REGISTERED', async () => {
      const profile = programProfileFactory()

      vi.mocked(validateEnrollment).mockResolvedValue(undefined)
      prismaMock.$transaction.mockImplementation(async (cb: any) => {
        return await cb(prismaMock)
      })
      prismaMock.programProfile.create.mockResolvedValue(profile as any)

      await createProgramProfileWithEnrollment({
        personId: '123e4567-e89b-12d3-a456-426614174000',
        program: 'MAHAD_PROGRAM',
      })

      const createCall = prismaMock.programProfile.create.mock.calls[0][0]
      expect(createCall.data.status).toBe('REGISTERED')
    })

    it('should default monthlyRate to 150', async () => {
      const profile = programProfileFactory()

      vi.mocked(validateEnrollment).mockResolvedValue(undefined)
      prismaMock.$transaction.mockImplementation(async (cb: any) => {
        return await cb(prismaMock)
      })
      prismaMock.programProfile.create.mockResolvedValue(profile as any)

      await createProgramProfileWithEnrollment({
        personId: '123e4567-e89b-12d3-a456-426614174000',
        program: 'MAHAD_PROGRAM',
      })

      const createCall = prismaMock.programProfile.create.mock.calls[0][0]
      expect(createCall.data.monthlyRate).toBe(150)
    })

    it('should default customRate to false', async () => {
      const profile = programProfileFactory()

      vi.mocked(validateEnrollment).mockResolvedValue(undefined)
      prismaMock.$transaction.mockImplementation(async (cb: any) => {
        return await cb(prismaMock)
      })
      prismaMock.programProfile.create.mockResolvedValue(profile as any)

      await createProgramProfileWithEnrollment({
        personId: '123e4567-e89b-12d3-a456-426614174000',
        program: 'MAHAD_PROGRAM',
      })

      const createCall = prismaMock.programProfile.create.mock.calls[0][0]
      expect(createCall.data.customRate).toBe(false)
    })

    it('should create profile with all education fields', async () => {
      const profile = programProfileFactory()

      vi.mocked(validateEnrollment).mockResolvedValue(undefined)
      prismaMock.$transaction.mockImplementation(async (cb: any) => {
        return await cb(prismaMock)
      })
      prismaMock.programProfile.create.mockResolvedValue(profile as any)

      await createProgramProfileWithEnrollment({
        personId: '123e4567-e89b-12d3-a456-426614174000',
        program: 'MAHAD_PROGRAM',
        educationLevel: 'COLLEGE',
        gradeLevel: 'FRESHMAN',
        schoolName: 'University of Minnesota',
        highSchoolGradYear: 2020,
        highSchoolGraduated: true,
      })

      const createCall = prismaMock.programProfile.create.mock.calls[0][0]
      expect(createCall.data.educationLevel).toBe('COLLEGE')
      expect(createCall.data.gradeLevel).toBe('FRESHMAN')
      expect(createCall.data.schoolName).toBe('University of Minnesota')
      expect(createCall.data.highSchoolGradYear).toBe(2020)
      expect(createCall.data.highSchoolGraduated).toBe(true)
    })

    it('should validate schoolName length', async () => {
      const longSchoolName = 'a'.repeat(256)

      await expect(
        createProgramProfileWithEnrollment({
          personId: '123e4567-e89b-12d3-a456-426614174000',
          program: 'MAHAD_PROGRAM',
          schoolName: longSchoolName,
        })
      ).rejects.toThrow('School name is too long')
    })

    it('should validate familyReferenceId is UUID if provided', async () => {
      await expect(
        createProgramProfileWithEnrollment({
          personId: '123e4567-e89b-12d3-a456-426614174000',
          program: 'DUGSI_PROGRAM',
          familyReferenceId: 'invalid-uuid',
        })
      ).rejects.toThrow('Family reference ID must be a valid UUID')
    })

    it('should throw error if validateEnrollment fails', async () => {
      vi.mocked(validateEnrollment).mockRejectedValue(
        new Error('Dugsi enrollments cannot have batches')
      )

      await expect(
        createProgramProfileWithEnrollment({
          personId: '123e4567-e89b-12d3-a456-426614174000',
          program: 'DUGSI_PROGRAM',
          batchId: '123e4567-e89b-12d3-a456-426614174000',
        })
      ).rejects.toThrow('Dugsi enrollments cannot have batches')
    })
  })
})
