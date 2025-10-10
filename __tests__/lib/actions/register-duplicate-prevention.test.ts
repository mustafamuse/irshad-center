/**
 * Duplicate Prevention Tests for Student Registration
 *
 * Comprehensive tests for duplicate detection logic in registerWithSiblings function.
 * Tests phone number normalization, email validation, and edge cases.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

import { registerWithSiblings } from '@/lib/actions/register'
import { prisma } from '@/lib/db'

// Mock Prisma client
vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: vi.fn(),
    student: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    sibling: {
      create: vi.fn(),
    },
  },
}))

// Mock the schema validation
vi.mock('@/app/mahad/register/schema', () => ({
  studentFormSchema: {
    parse: vi.fn((data) => data),
  },
}))

describe('Student Registration - Duplicate Prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Phone Number Duplicate Detection', () => {
    it('should prevent registration with exact duplicate phone number', async () => {
      const studentData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '1234567890',
        dateOfBirth: new Date('2010-01-01'),
        educationLevel: 'HIGH_SCHOOL',
        gradeLevel: 'FRESHMAN',
        schoolName: 'Test High School',
      }

      // Mock transaction to test the duplicate check logic
      const mockTransaction = async (callback: any) => {
        const tx = {
          student: {
            findMany: vi.fn().mockResolvedValue([
              {
                id: 'existing-student-1',
                name: 'Jane Doe',
                phone: '1234567890',
                email: 'jane@example.com',
              },
            ]),
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn(),
            findUnique: vi.fn(),
          },
          sibling: {
            create: vi.fn(),
          },
        }
        return callback(tx)
      }

      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction)

      await expect(
        registerWithSiblings({
          studentData,
          siblingIds: null,
        })
      ).rejects.toThrow(
        'A student with phone number 1234567890 already exists: Jane Doe'
      )
    })

    it('should detect duplicate with different phone formats - spaces', async () => {
      const studentData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '123 456 7890', // With spaces
        dateOfBirth: new Date('2010-01-01'),
        educationLevel: 'HIGH_SCHOOL',
        gradeLevel: 'FRESHMAN',
        schoolName: 'Test High School',
      }

      const mockTransaction = async (callback: any) => {
        const tx = {
          student: {
            findMany: vi.fn().mockResolvedValue([
              {
                id: 'existing-student-1',
                name: 'Jane Doe',
                phone: '1234567890', // Without spaces
                email: 'jane@example.com',
              },
            ]),
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn(),
            findUnique: vi.fn(),
          },
          sibling: {
            create: vi.fn(),
          },
        }
        return callback(tx)
      }

      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction)

      await expect(
        registerWithSiblings({
          studentData,
          siblingIds: null,
        })
      ).rejects.toThrow()
    })

    it('should detect duplicate with different phone formats - dashes', async () => {
      const studentData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '123-456-7890', // With dashes
        dateOfBirth: new Date('2010-01-01'),
        educationLevel: 'HIGH_SCHOOL',
        gradeLevel: 'FRESHMAN',
        schoolName: 'Test High School',
      }

      const mockTransaction = async (callback: any) => {
        const tx = {
          student: {
            findMany: vi.fn().mockResolvedValue([
              {
                id: 'existing-student-1',
                name: 'Jane Doe',
                phone: '(123) 456-7890', // With parentheses and dashes
                email: 'jane@example.com',
              },
            ]),
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn(),
            findUnique: vi.fn(),
          },
          sibling: {
            create: vi.fn(),
          },
        }
        return callback(tx)
      }

      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction)

      await expect(
        registerWithSiblings({
          studentData,
          siblingIds: null,
        })
      ).rejects.toThrow()
    })

    it('should detect duplicate with international format', async () => {
      const studentData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+1 (123) 456-7890', // International format - becomes 11234567890
        dateOfBirth: new Date('2010-01-01'),
        educationLevel: 'HIGH_SCHOOL',
        gradeLevel: 'FRESHMAN',
        schoolName: 'Test High School',
      }

      const mockTransaction = async (callback: any) => {
        const tx = {
          student: {
            findMany: vi.fn().mockResolvedValue([
              {
                id: 'existing-student-1',
                name: 'Jane Doe',
                phone: '+1-123-456-7890', // Same international format - becomes 11234567890
                email: 'jane@example.com',
              },
            ]),
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn(),
            findUnique: vi.fn(),
          },
          sibling: {
            create: vi.fn(),
          },
        }
        return callback(tx)
      }

      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction)

      await expect(
        registerWithSiblings({
          studentData,
          siblingIds: null,
        })
      ).rejects.toThrow()
    })

    it('should allow registration with phone number less than 7 digits', async () => {
      const studentData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '12345', // Only 5 digits - should skip validation
        dateOfBirth: new Date('2010-01-01'),
        educationLevel: 'HIGH_SCHOOL',
        gradeLevel: 'FRESHMAN',
        schoolName: 'Test High School',
      }

      const mockTransaction = async (callback: any) => {
        const tx = {
          student: {
            findMany: vi.fn().mockResolvedValue([]),
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({
              id: 'new-student-1',
              name: 'John Doe',
              email: 'john@example.com',
              phone: '12345',
            }),
            findUnique: vi.fn(),
          },
          sibling: {
            create: vi.fn(),
          },
        }
        return callback(tx)
      }

      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction)

      const result = await registerWithSiblings({
        studentData,
        siblingIds: null,
      })

      expect(result.success).toBe(true)
    })

    it('should handle 7-digit phone numbers (minimum valid length)', async () => {
      const studentData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '1234567', // Exactly 7 digits
        dateOfBirth: new Date('2010-01-01'),
        educationLevel: 'HIGH_SCHOOL',
        gradeLevel: 'FRESHMAN',
        schoolName: 'Test High School',
      }

      const mockTransaction = async (callback: any) => {
        const tx = {
          student: {
            findMany: vi.fn().mockResolvedValue([
              {
                id: 'existing-student-1',
                name: 'Jane Doe',
                phone: '123-4567',
                email: 'jane@example.com',
              },
            ]),
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn(),
            findUnique: vi.fn(),
          },
          sibling: {
            create: vi.fn(),
          },
        }
        return callback(tx)
      }

      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction)

      await expect(
        registerWithSiblings({
          studentData,
          siblingIds: null,
        })
      ).rejects.toThrow()
    })
  })

  describe('Email Duplicate Detection', () => {
    it('should prevent registration with duplicate email', async () => {
      const studentData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '9876543210',
        dateOfBirth: new Date('2010-01-01'),
        educationLevel: 'HIGH_SCHOOL',
        gradeLevel: 'FRESHMAN',
        schoolName: 'Test High School',
      }

      const mockTransaction = async (callback: any) => {
        const tx = {
          student: {
            findMany: vi.fn().mockResolvedValue([]),
            findFirst: vi.fn().mockResolvedValue({
              id: 'existing-student-1',
              name: 'Jane Doe',
              email: 'john@example.com',
            }),
            create: vi.fn(),
            findUnique: vi.fn(),
          },
          sibling: {
            create: vi.fn(),
          },
        }
        return callback(tx)
      }

      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction)

      await expect(
        registerWithSiblings({
          studentData,
          siblingIds: null,
        })
      ).rejects.toThrow(
        'A student with email john@example.com already exists: Jane Doe'
      )
    })

    it('should detect duplicate email with different case (case-insensitive)', async () => {
      const studentData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'JOHN@EXAMPLE.COM', // Uppercase
        phone: '9876543210',
        dateOfBirth: new Date('2010-01-01'),
        educationLevel: 'HIGH_SCHOOL',
        gradeLevel: 'FRESHMAN',
        schoolName: 'Test High School',
      }

      const mockTransaction = async (callback: any) => {
        const tx = {
          student: {
            findMany: vi.fn().mockResolvedValue([]),
            findFirst: vi.fn().mockResolvedValue({
              id: 'existing-student-1',
              name: 'Jane Doe',
              email: 'john@example.com', // Lowercase
            }),
            create: vi.fn(),
            findUnique: vi.fn(),
          },
          sibling: {
            create: vi.fn(),
          },
        }
        return callback(tx)
      }

      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction)

      await expect(
        registerWithSiblings({
          studentData,
          siblingIds: null,
        })
      ).rejects.toThrow()
    })

    it('should allow registration without email', async () => {
      const studentData = {
        firstName: 'John',
        lastName: 'Doe',
        email: undefined,
        phone: '1234567890',
        dateOfBirth: new Date('2010-01-01'),
        educationLevel: 'HIGH_SCHOOL',
        gradeLevel: 'FRESHMAN',
        schoolName: 'Test High School',
      }

      const mockTransaction = async (callback: any) => {
        const tx = {
          student: {
            findMany: vi.fn().mockResolvedValue([]),
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({
              id: 'new-student-1',
              name: 'John Doe',
              phone: '1234567890',
            }),
            findUnique: vi.fn(),
          },
          sibling: {
            create: vi.fn(),
          },
        }
        return callback(tx)
      }

      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction)

      const result = await registerWithSiblings({
        studentData,
        siblingIds: null,
      })

      expect(result.success).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('should allow registration with null phone number', async () => {
      const studentData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: null,
        dateOfBirth: new Date('2010-01-01'),
        educationLevel: 'HIGH_SCHOOL',
        gradeLevel: 'FRESHMAN',
        schoolName: 'Test High School',
      }

      const mockTransaction = async (callback: any) => {
        const tx = {
          student: {
            findMany: vi.fn().mockResolvedValue([]),
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({
              id: 'new-student-1',
              name: 'John Doe',
              email: 'john@example.com',
              phone: null,
            }),
            findUnique: vi.fn(),
          },
          sibling: {
            create: vi.fn(),
          },
        }
        return callback(tx)
      }

      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction)

      const result = await registerWithSiblings({
        studentData,
        siblingIds: null,
      })

      expect(result.success).toBe(true)
    })

    it('should allow registration with empty string phone number', async () => {
      const studentData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '',
        dateOfBirth: new Date('2010-01-01'),
        educationLevel: 'HIGH_SCHOOL',
        gradeLevel: 'FRESHMAN',
        schoolName: 'Test High School',
      }

      const mockTransaction = async (callback: any) => {
        const tx = {
          student: {
            findMany: vi.fn().mockResolvedValue([]),
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({
              id: 'new-student-1',
              name: 'John Doe',
              email: 'john@example.com',
              phone: '',
            }),
            findUnique: vi.fn(),
          },
          sibling: {
            create: vi.fn(),
          },
        }
        return callback(tx)
      }

      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction)

      const result = await registerWithSiblings({
        studentData,
        siblingIds: null,
      })

      expect(result.success).toBe(true)
    })

    it('should handle phone with only non-digit characters', async () => {
      const studentData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '(---) ---',
        dateOfBirth: new Date('2010-01-01'),
        educationLevel: 'HIGH_SCHOOL',
        gradeLevel: 'FRESHMAN',
        schoolName: 'Test High School',
      }

      const mockTransaction = async (callback: any) => {
        const tx = {
          student: {
            findMany: vi.fn().mockResolvedValue([]),
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({
              id: 'new-student-1',
              name: 'John Doe',
              email: 'john@example.com',
              phone: '(---) ---',
            }),
            findUnique: vi.fn(),
          },
          sibling: {
            create: vi.fn(),
          },
        }
        return callback(tx)
      }

      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction)

      const result = await registerWithSiblings({
        studentData,
        siblingIds: null,
      })

      expect(result.success).toBe(true)
    })
  })

  describe('Successful Registration', () => {
    it('should successfully register student with unique phone and email', async () => {
      const studentData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '1234567890',
        dateOfBirth: new Date('2010-01-01'),
        educationLevel: 'HIGH_SCHOOL',
        gradeLevel: 'FRESHMAN',
        schoolName: 'Test High School',
      }

      const mockTransaction = async (callback: any) => {
        const tx = {
          student: {
            findMany: vi.fn().mockResolvedValue([]), // No duplicates
            findFirst: vi.fn().mockResolvedValue(null), // No email duplicates
            create: vi.fn().mockResolvedValue({
              id: 'new-student-1',
              name: 'John Doe',
              email: 'john@example.com',
              phone: '1234567890',
              dateOfBirth: new Date('2010-01-01'),
              educationLevel: 'HIGH_SCHOOL',
              gradeLevel: 'FRESHMAN',
              schoolName: 'Test High School',
            }),
            findUnique: vi.fn(),
          },
          sibling: {
            create: vi.fn(),
          },
        }
        return callback(tx)
      }

      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction)

      const result = await registerWithSiblings({
        studentData,
        siblingIds: null,
      })

      expect(result.success).toBe(true)
      expect(result.student).toBeDefined()
      expect(result.student.name).toBe('John Doe')
    })

    it('should successfully register student with siblings', async () => {
      const studentData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '1234567890',
        dateOfBirth: new Date('2010-01-01'),
        educationLevel: 'HIGH_SCHOOL',
        gradeLevel: 'FRESHMAN',
        schoolName: 'Test High School',
      }

      const siblingIds = ['sibling-1', 'sibling-2']

      const mockTransaction = async (callback: any) => {
        const tx = {
          student: {
            findMany: vi.fn().mockResolvedValue([]),
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({
              id: 'new-student-1',
              name: 'John Doe',
              email: 'john@example.com',
              phone: '1234567890',
            }),
            findUnique: vi.fn().mockResolvedValue({
              id: 'new-student-1',
              name: 'John Doe',
              email: 'john@example.com',
              phone: '1234567890',
              siblingGroup: {
                id: 'sibling-group-1',
                students: [
                  { id: 'new-student-1', name: 'John Doe', email: 'john@example.com' },
                  { id: 'sibling-1', name: 'Jane Doe', email: 'jane@example.com' },
                  { id: 'sibling-2', name: 'Jack Doe', email: 'jack@example.com' },
                ],
              },
            }),
          },
          sibling: {
            create: vi.fn().mockResolvedValue({
              id: 'sibling-group-1',
            }),
          },
        }
        return callback(tx)
      }

      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction)

      const result = await registerWithSiblings({
        studentData,
        siblingIds,
      })

      expect(result.success).toBe(true)
      expect(result.siblingGroup).toBeDefined()
    })

    it('should capitalize names correctly', async () => {
      const studentData = {
        firstName: 'john',
        lastName: 'doe',
        email: 'john@example.com',
        phone: '1234567890',
        dateOfBirth: new Date('2010-01-01'),
        educationLevel: 'HIGH_SCHOOL',
        gradeLevel: 'FRESHMAN',
        schoolName: 'Test High School',
      }

      const mockTransaction = async (callback: any) => {
        const tx = {
          student: {
            findMany: vi.fn().mockResolvedValue([]),
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockImplementation((args) => {
              // Verify the name is capitalized
              expect(args.data.name).toBe('John Doe')
              return Promise.resolve({
                id: 'new-student-1',
                name: args.data.name,
                email: 'john@example.com',
                phone: '1234567890',
              })
            }),
            findUnique: vi.fn(),
          },
          sibling: {
            create: vi.fn(),
          },
        }
        return callback(tx)
      }

      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction)

      await registerWithSiblings({
        studentData,
        siblingIds: null,
      })
    })
  })

  describe('Database Query Efficiency', () => {
    it('should not query phone duplicates if phone is not provided', async () => {
      const studentData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: undefined,
        dateOfBirth: new Date('2010-01-01'),
        educationLevel: 'HIGH_SCHOOL',
        gradeLevel: 'FRESHMAN',
        schoolName: 'Test High School',
      }

      const mockFindMany = vi.fn().mockResolvedValue([])
      const mockFindFirst = vi.fn().mockResolvedValue(null)

      const mockTransaction = async (callback: any) => {
        const tx = {
          student: {
            findMany: mockFindMany,
            findFirst: mockFindFirst,
            create: vi.fn().mockResolvedValue({
              id: 'new-student-1',
              name: 'John Doe',
              email: 'john@example.com',
            }),
            findUnique: vi.fn(),
          },
          sibling: {
            create: vi.fn(),
          },
        }
        return callback(tx)
      }

      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction)

      await registerWithSiblings({
        studentData,
        siblingIds: null,
      })

      // Should not call findMany for phone check
      expect(mockFindMany).not.toHaveBeenCalled()
    })

    it('should not query email duplicates if email is not provided', async () => {
      const studentData = {
        firstName: 'John',
        lastName: 'Doe',
        email: undefined,
        phone: '1234567890',
        dateOfBirth: new Date('2010-01-01'),
        educationLevel: 'HIGH_SCHOOL',
        gradeLevel: 'FRESHMAN',
        schoolName: 'Test High School',
      }

      const mockFindMany = vi.fn().mockResolvedValue([])
      const mockFindFirst = vi.fn().mockResolvedValue(null)

      const mockTransaction = async (callback: any) => {
        const tx = {
          student: {
            findMany: mockFindMany,
            findFirst: mockFindFirst,
            create: vi.fn().mockResolvedValue({
              id: 'new-student-1',
              name: 'John Doe',
              phone: '1234567890',
            }),
            findUnique: vi.fn(),
          },
          sibling: {
            create: vi.fn(),
          },
        }
        return callback(tx)
      }

      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction)

      await registerWithSiblings({
        studentData,
        siblingIds: null,
      })

      // Should call findMany for phone check
      expect(mockFindMany).toHaveBeenCalled()
      // Should not call findFirst for email check
      expect(mockFindFirst).not.toHaveBeenCalled()
    })
  })
})
