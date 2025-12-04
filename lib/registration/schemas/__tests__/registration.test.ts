import { describe, it, expect } from 'vitest'

import {
  dugsiRegistrationSchema,
  childInfoSchema,
  DEFAULT_CHILD_VALUES,
} from '../registration'

describe('dugsiRegistrationSchema', () => {
  const validParentData = {
    parent1FirstName: 'John',
    parent1LastName: 'Smith',
    parent1Email: 'john@example.com',
    parent1Phone: '612-555-1234',
    isSingleParent: false,
    parent2FirstName: 'Jane',
    parent2LastName: 'Smith',
    parent2Email: 'jane@example.com',
    parent2Phone: '612-555-5678',
    primaryPayer: 'parent1' as const,
  }

  const validChildData = {
    ...DEFAULT_CHILD_VALUES,
    firstName: 'Alice',
    lastName: 'Smith',
    gender: 'FEMALE' as const,
    dateOfBirth: new Date('2010-01-01'),
    shift: 'MORNING' as const,
    schoolLevel: 'ELEMENTARY' as const,
    grade: 'GRADE_5' as const,
    schoolName: 'Test Elementary',
    healthInfo: 'None',
    useCustomLastName: false,
    useCustomShift: false,
  }

  describe('child lastName sync validation', () => {
    it('allows single child', () => {
      const data = {
        ...validParentData,
        children: [validChildData],
      }

      const result = dugsiRegistrationSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    it('allows multiple children with same last name (not custom)', () => {
      const data = {
        ...validParentData,
        children: [
          { ...validChildData, firstName: 'Alice', lastName: 'Smith' },
          {
            ...validChildData,
            firstName: 'Bob',
            lastName: 'Smith',
            useCustomLastName: false,
          },
          {
            ...validChildData,
            firstName: 'Charlie',
            lastName: 'Smith',
            useCustomLastName: false,
          },
        ],
      }

      const result = dugsiRegistrationSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    it('allows custom last name override', () => {
      const data = {
        ...validParentData,
        children: [
          { ...validChildData, firstName: 'Alice', lastName: 'Smith' },
          {
            ...validChildData,
            firstName: 'Bob',
            lastName: 'Jones',
            useCustomLastName: true,
          },
        ],
      }

      const result = dugsiRegistrationSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    it('rejects non-custom children with different last names', () => {
      const data = {
        ...validParentData,
        children: [
          { ...validChildData, firstName: 'Alice', lastName: 'Smith' },
          {
            ...validChildData,
            firstName: 'Bob',
            lastName: 'Jones', // Different but useCustomLastName = false
            useCustomLastName: false,
          },
        ],
      }

      const result = dugsiRegistrationSchema.safeParse(data)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain(
          'Children using first child last name must match first child'
        )
      }
    })

    it('handles mixed custom and non-custom last names', () => {
      const data = {
        ...validParentData,
        children: [
          { ...validChildData, firstName: 'Alice', lastName: 'Smith' },
          {
            ...validChildData,
            firstName: 'Bob',
            lastName: 'Jones',
            useCustomLastName: true,
          },
          {
            ...validChildData,
            firstName: 'Charlie',
            lastName: 'Smith', // Matches first child
            useCustomLastName: false,
          },
        ],
      }

      const result = dugsiRegistrationSchema.safeParse(data)
      expect(result.success).toBe(true)
    })
  })

  describe('child shift sync validation', () => {
    it('allows multiple children with same shift (not custom)', () => {
      const data = {
        ...validParentData,
        children: [
          { ...validChildData, firstName: 'Alice', shift: 'MORNING' as const },
          {
            ...validChildData,
            firstName: 'Bob',
            shift: 'MORNING' as const,
            useCustomShift: false,
          },
        ],
      }

      const result = dugsiRegistrationSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    it('allows custom shift override', () => {
      const data = {
        ...validParentData,
        children: [
          { ...validChildData, firstName: 'Alice', shift: 'MORNING' as const },
          {
            ...validChildData,
            firstName: 'Bob',
            shift: 'AFTERNOON' as const,
            useCustomShift: true,
          },
        ],
      }

      const result = dugsiRegistrationSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    it('rejects non-custom children with different shifts', () => {
      const data = {
        ...validParentData,
        children: [
          { ...validChildData, firstName: 'Alice', shift: 'MORNING' as const },
          {
            ...validChildData,
            firstName: 'Bob',
            shift: 'AFTERNOON' as const, // Different but useCustomShift = false
            useCustomShift: false,
          },
        ],
      }

      const result = dugsiRegistrationSchema.safeParse(data)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain(
          'Children using first child shift must match first child'
        )
      }
    })

    it('handles mixed custom and non-custom shifts', () => {
      const data = {
        ...validParentData,
        children: [
          { ...validChildData, firstName: 'Alice', shift: 'MORNING' as const },
          {
            ...validChildData,
            firstName: 'Bob',
            shift: 'AFTERNOON' as const,
            useCustomShift: true,
          },
          {
            ...validChildData,
            firstName: 'Charlie',
            shift: 'MORNING' as const, // Matches first child
            useCustomShift: false,
          },
        ],
      }

      const result = dugsiRegistrationSchema.safeParse(data)
      expect(result.success).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('handles empty last name for first child', () => {
      const data = {
        ...validParentData,
        children: [
          { ...validChildData, firstName: 'Alice', lastName: '' },
          {
            ...validChildData,
            firstName: 'Bob',
            lastName: '',
            useCustomLastName: false,
          },
        ],
      }

      const result = dugsiRegistrationSchema.safeParse(data)
      // Should fail due to lastName validation, not sync validation
      expect(result.success).toBe(false)
    })

    it('validates first child is always template (useCustom flags ignored)', () => {
      const data = {
        ...validParentData,
        children: [
          {
            ...validChildData,
            firstName: 'Alice',
            lastName: 'Smith',
            useCustomLastName: true, // Ignored for first child
            useCustomShift: true, // Ignored for first child
          },
          {
            ...validChildData,
            firstName: 'Bob',
            lastName: 'Smith',
            shift: 'MORNING' as const,
          },
        ],
      }

      const result = dugsiRegistrationSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    it.skip('handles three children with mixed custom overrides', () => {
      const data = {
        ...validParentData,
        children: [
          {
            ...validChildData,
            firstName: 'Child1',
            lastName: 'Smith',
            shift: 'MORNING' as const,
          },
          {
            ...validChildData,
            firstName: 'Child2',
            lastName: 'Jones',
            shift: 'AFTERNOON' as const,
            useCustomLastName: true,
            useCustomShift: true,
          },
          {
            ...validChildData,
            firstName: 'Child3',
            lastName: 'Smith',
            shift: 'MORNING' as const,
            useCustomLastName: false,
            useCustomShift: false,
          },
        ],
      }

      const result = dugsiRegistrationSchema.safeParse(data)
      expect(result.success).toBe(true)
    })
  })

  describe('childInfoSchema', () => {
    it('validates useCustomLastName is boolean', () => {
      const data = {
        ...validChildData,
        useCustomLastName: 'invalid',
      }

      const result = childInfoSchema.safeParse(data)
      expect(result.success).toBe(false)
    })

    it('validates useCustomShift is boolean', () => {
      const data = {
        ...validChildData,
        useCustomShift: 'invalid',
      }

      const result = childInfoSchema.safeParse(data)
      expect(result.success).toBe(false)
    })

    it('defaults useCustomLastName to false', () => {
      const { useCustomLastName: _, ...dataWithoutFlag } = validChildData

      const result = childInfoSchema.safeParse(dataWithoutFlag)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.useCustomLastName).toBe(false)
      }
    })

    it('defaults useCustomShift to false', () => {
      const { useCustomShift: _, ...dataWithoutFlag } = validChildData

      const result = childInfoSchema.safeParse(dataWithoutFlag)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.useCustomShift).toBe(false)
      }
    })
  })
})
