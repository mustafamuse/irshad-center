import { vi, describe, it, expect } from 'vitest'

vi.mock('@/lib/logger', () => ({
  createServiceLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}))

import { groupByFamily } from '../group'

type Registration = Parameters<typeof groupByFamily>[0][number]

function makeRegistration(overrides: Partial<Registration>): Registration {
  return {
    id: 'reg-1',
    name: 'Child One',
    familyReferenceId: 'family-ref-1',
    parentFirstName: 'Amina',
    parentLastName: 'Hassan',
    parentEmail: 'amina@example.com',
    parentPhone: '612-555-1234',
    parent2FirstName: null,
    parent2LastName: null,
    parent2Email: null,
    parent2Phone: null,
    gradeLevel: null,
    schoolName: null,
    dateOfBirth: new Date('2015-06-01'),
    gender: null,
    createdAt: new Date('2026-08-01'),
    ...overrides,
  } as Registration
}

describe('groupByFamily', () => {
  it('never puts a raw email in familyKey, even for legacy rows without familyReferenceId', () => {
    const families = groupByFamily([
      makeRegistration({ id: 'reg-1', familyReferenceId: null }),
      makeRegistration({ id: 'reg-2', familyReferenceId: 'family-ref-2' }),
    ])

    for (const family of families) {
      expect(family.familyKey).not.toContain('@')
    }
  })

  it('groups legacy siblings sharing a parent email under one hashed key', () => {
    const families = groupByFamily([
      makeRegistration({ id: 'reg-1', familyReferenceId: null }),
      makeRegistration({
        id: 'reg-2',
        name: 'Child Two',
        familyReferenceId: null,
      }),
    ])

    expect(families).toHaveLength(1)
    expect(families[0].children).toHaveLength(2)
    expect(families[0].familyKey).toMatch(/^l:\d+$/)
  })

  it('assigns distinct opaque keys to distinct legacy families', () => {
    const families = groupByFamily([
      makeRegistration({ id: 'reg-1', familyReferenceId: null }),
      makeRegistration({
        id: 'reg-2',
        familyReferenceId: null,
        parentEmail: 'other@example.com',
      }),
      makeRegistration({
        id: 'reg-3',
        familyReferenceId: null,
        parentEmail: null,
      }),
    ])

    const keys = families.map((f) => f.familyKey)
    expect(new Set(keys).size).toBe(3)
    for (const key of keys) {
      expect(key).toMatch(/^l:\d+$/)
    }
  })

  it('ships only masked contacts and age, never raw email, phone, or DOB', () => {
    const [family] = groupByFamily([makeRegistration({})])

    expect(family.parent1MaskedEmail).toBe('a•••@example.com')
    expect(family.parent1MaskedPhone).toBe('•••-•••-1234')
    expect(family.children[0].ageYears).toBeGreaterThan(9)
    expect(JSON.stringify(family)).not.toContain('amina@example.com')
    expect(JSON.stringify(family)).not.toContain('6125551234')
    expect(JSON.stringify(family)).not.toContain('2015-06-01')
  })
})
