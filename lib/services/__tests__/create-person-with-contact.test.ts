import { vi, describe, it, expect, beforeEach } from 'vitest' // eslint-disable-line import/order

const {
  mockPersonCreate,
  mockPersonUpdate,
  mockPersonFindUniqueOrThrow,
  mockFindPersonByActiveContact,
} = vi.hoisted(() => ({
  mockPersonCreate: vi.fn(),
  mockPersonUpdate: vi.fn(),
  mockPersonFindUniqueOrThrow: vi.fn(),
  mockFindPersonByActiveContact: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    person: {
      create: (...args: unknown[]) => mockPersonCreate(...args),
      update: (...args: unknown[]) => mockPersonUpdate(...args),
      findUniqueOrThrow: (...args: unknown[]) =>
        mockPersonFindUniqueOrThrow(...args),
    },
  },
}))

vi.mock('@/lib/db/queries/program-profile', () => ({
  findPersonByActiveContact: (...args: unknown[]) =>
    mockFindPersonByActiveContact(...args),
}))

vi.mock('@/lib/logger', () => ({
  createServiceLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn().mockReturnThis(),
  })),
  logError: vi.fn(),
}))

vi.mock('@/lib/services/validation-service', () => ({
  validateEnrollment: vi.fn(),
  ValidationError: class extends Error {
    code: string
    constructor(msg: string, code: string) {
      super(msg)
      this.code = code
    }
  },
}))

import { createPersonWithContact } from '../registration-service'

async function makeP2002(field: string = 'email') {
  const { Prisma } = await import('@prisma/client')
  return new Prisma.PrismaClientKnownRequestError(
    `Unique constraint failed on the fields: (\`${field}\`)`,
    { code: 'P2002', clientVersion: '6.0.0' }
  )
}

const validInput = {
  name: 'Fatima Ali',
  email: 'fatima@example.com',
  phone: '612-555-1234',
}

const createdPerson = {
  id: 'person-1',
  name: 'Fatima Ali',
  email: 'fatima@example.com',
  phone: '6125551234',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createPersonWithContact', () => {
  describe('happy path', () => {
    it('should create and return a person', async () => {
      mockPersonCreate.mockResolvedValue(createdPerson)

      const result = await createPersonWithContact(validInput)

      expect(result).toEqual(createdPerson)
      expect(mockPersonCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Fatima Ali',
            email: 'fatima@example.com',
            phone: '6125551234',
          }),
        })
      )
    })

    it('should normalize email to lowercase', async () => {
      mockPersonCreate.mockResolvedValue(createdPerson)

      await createPersonWithContact({
        ...validInput,
        email: 'FATIMA@Example.COM',
      })

      expect(mockPersonCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'fatima@example.com',
          }),
        })
      )
    })

    it('should normalize phone to 10 digits', async () => {
      mockPersonCreate.mockResolvedValue(createdPerson)

      await createPersonWithContact(validInput)

      expect(mockPersonCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            phone: '6125551234',
          }),
        })
      )
    })
  })

  describe('phone validation', () => {
    it('should reject invalid phone at Zod schema level', async () => {
      await expect(
        createPersonWithContact({
          name: 'Test',
          phone: 'abc',
        })
      ).rejects.toThrow()

      expect(mockPersonCreate).not.toHaveBeenCalled()
    })
  })

  describe('transaction path', () => {
    it('should skip try-catch when tx is provided', async () => {
      const txCreate = vi.fn().mockResolvedValue(createdPerson)
      const tx = { person: { create: txCreate } } as unknown as Parameters<
        typeof createPersonWithContact
      >[1]

      const result = await createPersonWithContact(validInput, tx)

      expect(result).toEqual(createdPerson)
      expect(txCreate).toHaveBeenCalled()
      expect(mockPersonCreate).not.toHaveBeenCalled()
    })

    it('should let P2002 propagate when tx is provided', async () => {
      const p2002 = await makeP2002()
      const txCreate = vi.fn().mockRejectedValue(p2002)
      const tx = { person: { create: txCreate } } as unknown as Parameters<
        typeof createPersonWithContact
      >[1]

      await expect(createPersonWithContact(validInput, tx)).rejects.toThrow(
        p2002
      )
      expect(mockFindPersonByActiveContact).not.toHaveBeenCalled()
    })
  })

  describe('P2002 recovery (no tx)', () => {
    it('should return existing person when found and no merge needed', async () => {
      const existing = {
        id: 'existing-1',
        name: 'Fatima Ali',
        email: 'fatima@example.com',
        phone: '6125551234',
      }
      mockPersonCreate.mockRejectedValue(await makeP2002())
      mockFindPersonByActiveContact.mockResolvedValue(existing)

      const result = await createPersonWithContact(validInput)

      expect(result).toEqual(existing)
      expect(mockPersonUpdate).not.toHaveBeenCalled()
    })

    it('should fill null email via conservative merge', async () => {
      const existingNoEmail = {
        id: 'existing-1',
        name: 'Fatima Ali',
        email: null,
        phone: '6125551234',
      }
      const updated = { ...existingNoEmail, email: 'fatima@example.com' }

      mockPersonCreate.mockRejectedValue(await makeP2002('phone'))
      mockFindPersonByActiveContact.mockResolvedValue(existingNoEmail)
      mockPersonUpdate.mockResolvedValue(updated)

      const result = await createPersonWithContact(validInput)

      expect(result).toEqual(updated)
      expect(mockPersonUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'existing-1' },
          data: { email: 'fatima@example.com' },
        })
      )
    })

    it('should fill null phone via conservative merge', async () => {
      const existingNoPhone = {
        id: 'existing-1',
        name: 'Fatima Ali',
        email: 'fatima@example.com',
        phone: null,
      }
      const updated = { ...existingNoPhone, phone: '6125551234' }

      mockPersonCreate.mockRejectedValue(await makeP2002('email'))
      mockFindPersonByActiveContact.mockResolvedValue(existingNoPhone)
      mockPersonUpdate.mockResolvedValue(updated)

      const result = await createPersonWithContact(validInput)

      expect(result).toEqual(updated)
      expect(mockPersonUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'existing-1' },
          data: { phone: '6125551234' },
        })
      )
    })

    it('should NOT overwrite existing contact fields', async () => {
      const existingWithDifferentContacts = {
        id: 'existing-1',
        name: 'Fatima Ali',
        email: 'other@example.com',
        phone: '9525551234',
      }

      mockPersonCreate.mockRejectedValue(await makeP2002())
      mockFindPersonByActiveContact.mockResolvedValue(
        existingWithDifferentContacts
      )

      const result = await createPersonWithContact(validInput)

      expect(result).toEqual(existingWithDifferentContacts)
      expect(mockPersonUpdate).not.toHaveBeenCalled()
    })

    it('should handle second P2002 on merge update (concurrent race)', async () => {
      const existingNoPhone = {
        id: 'existing-1',
        name: 'Fatima Ali',
        email: 'fatima@example.com',
        phone: null,
      }
      const latestState = {
        id: 'existing-1',
        name: 'Fatima Ali',
        email: 'fatima@example.com',
        phone: '9525559999',
      }

      mockPersonCreate.mockRejectedValue(await makeP2002('email'))
      mockFindPersonByActiveContact.mockResolvedValue(existingNoPhone)
      mockPersonUpdate.mockRejectedValue(await makeP2002('phone'))
      mockPersonFindUniqueOrThrow.mockResolvedValue(latestState)

      const result = await createPersonWithContact(validInput)

      expect(result).toEqual(latestState)
      expect(mockPersonFindUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: 'existing-1' },
      })
    })

    it('should throw ActionError when findPersonByActiveContact returns null', async () => {
      mockPersonCreate.mockRejectedValue(await makeP2002('email'))
      mockFindPersonByActiveContact.mockResolvedValue(null)

      await expect(createPersonWithContact(validInput)).rejects.toThrow(
        'already associated with another person'
      )
    })
  })
})
