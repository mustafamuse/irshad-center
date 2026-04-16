import { describe, expect, it } from 'vitest'

import {
  getLastNameFromFullName,
  pickMahadRegistrationMatch,
  type MahadPublicLookupCandidate,
} from '../mahad-public-lookup'

function candidate(name: string): MahadPublicLookupCandidate {
  return {
    status: 'REGISTERED',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    person: { name },
    enrollments: [],
  }
}

describe('mahad public lookup helpers', () => {
  it('extracts the last token from a full name', () => {
    expect(getLastNameFromFullName('Abdi Nur Hassan')).toBe('Hassan')
    expect(getLastNameFromFullName('  Fatima   Ali  ')).toBe('Ali')
    expect(getLastNameFromFullName('')).toBe('')
  })

  it('returns null for ambiguous or missing matches', () => {
    expect(
      pickMahadRegistrationMatch(
        [candidate('Amina Hassan'), candidate('Abdi Hassan')],
        'hassan'
      )
    ).toBeNull()
    expect(pickMahadRegistrationMatch([candidate('Amina Ali')], 'hassan')).toBeNull()
  })

  it('returns the unique matching profile', () => {
    expect(
      pickMahadRegistrationMatch(
        [candidate('Amina Ali'), candidate('Abdi Hassan')],
        'hassan'
      )
    ).toMatchObject({ person: { name: 'Abdi Hassan' } })
  })
})
