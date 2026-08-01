import { describe, expect, it } from 'vitest'

import {
  compareNames,
  foldVariants,
  isAutoMatch,
  matchName,
  normalizeName,
} from '@/lib/utils/dugsi-name-match'

describe('normalizeName', () => {
  it('trims, lowercases, collapses whitespace, and converts hyphens to spaces', () => {
    expect(normalizeName('Mohamed-Amin ')).toBe('mohamed amin')
    expect(normalizeName('  Hamse   Abdi ')).toBe('hamse abdi')
  })

  it('strips diacritics', () => {
    expect(normalizeName('Súraya')).toBe('suraya')
  })
})

describe('foldVariants', () => {
  it('fixes the shiekh/sheikh transliteration', () => {
    expect(foldVariants('ismail shiekhali')).toBe('ismail sheikhali')
  })

  it('collapses doubled letters (Nuur→Nur, Yussuf→Yusuf, Abaas→Abas)', () => {
    expect(foldVariants('yusra nuur')).toBe('yusra nur')
    expect(foldVariants('yussuf')).toBe('yusuf')
    expect(foldVariants('abaas')).toBe('abas')
  })
})

describe('compareNames', () => {
  it('matches identical names as exact', () => {
    expect(compareNames('Hamse Abdi', 'Hamse Abdi').confidence).toBe('exact')
  })

  it('matches reordered tokens as high (token-set-equal)', () => {
    const cmp = compareNames('Abdi Hamse', 'Hamse Abdi')
    expect(cmp.confidence).toBe('high')
  })

  it('folds ShiekhAli vs Sheikhali to a high-confidence match', () => {
    const cmp = compareNames('Ismail ShiekhAli', 'Ismail Sheikhali')
    expect(cmp.confidence).toBe('high')
    expect(isAutoMatch(cmp.confidence)).toBe(true)
  })

  it('folds Nur vs Nuur to a match', () => {
    expect(
      isAutoMatch(compareNames('Yusra Nur', 'Yusra Nuur').confidence)
    ).toBe(true)
  })

  it('surfaces extra-token names as review candidates, never auto-match', () => {
    // Real data: "Hamza Mohamed" and "Hamza Mohamed Aziz" are DIFFERENT students.
    const cmp = compareNames('Hamza Mohamed Aziz', 'Hamza Mohamed')
    expect(cmp.confidence).not.toBe('none')
    expect(isAutoMatch(cmp.confidence)).toBe(false)
  })

  it('does NOT auto-match genuinely different surnames', () => {
    const cmp = compareNames('Ismail Hassan', 'Ismail Sheikhali')
    expect(isAutoMatch(cmp.confidence)).toBe(false)
  })

  it('does NOT match a repeated-token name to a superset sharing one token', () => {
    // Regression: "Ibrahim Ibrahim" must not auto-match "Hamza Ibrahim".
    const cmp = compareNames('Ibrahim Ibrahim', 'Hamza Ibrahim')
    expect(isAutoMatch(cmp.confidence)).toBe(false)
  })

  it('does NOT match a repeated-token name to its single-token half', () => {
    // Regression: Set-based token comparison collapses "Ibrahim Ibrahim" to
    // {Ibrahim}, which wrongly equals the token set of "Ibrahim".
    const cmp = compareNames('Ibrahim Ibrahim', 'Ibrahim')
    expect(isAutoMatch(cmp.confidence)).toBe(false)
  })

  it('matches close single-edit transliterations (Mohamed vs Mohamad) via fuzzy', () => {
    expect(
      isAutoMatch(compareNames('Mohamed Ali', 'Mohamad Ali').confidence)
    ).toBe(true)
  })

  it('matches across word-boundary differences (Sheikhali vs Shiekh Ali)', () => {
    const cmp = compareNames('Ismail Sheikhali', 'Ismail Shiekh Ali')
    expect(cmp.confidence).toBe('high')
    expect(isAutoMatch(cmp.confidence)).toBe(true)
  })

  it('never auto-matches single-token names beyond exact', () => {
    expect(compareNames('Anas', 'Anas').confidence).toBe('exact')
    expect(isAutoMatch(compareNames('Anas', 'Anas Mohamed').confidence)).toBe(
      false
    )
  })
})

describe('real-world reconciliation regressions (2026-05-30)', () => {
  // These pairs were confirmed same/different by the program owner. The ones the
  // matcher refuses are exactly why scripts/config CONFIRMED_ALIASES exists — the
  // matcher must stay conservative and NOT learn to merge them via fuzzy logic.

  it('does NOT auto-match same first name with different father name (Adan Gelle vs Adan Ogle)', () => {
    // Same child per the owner, but only knowable by human confirmation.
    const cmp = compareNames('Adan Gelle', 'Adan Ogle')
    expect(isAutoMatch(cmp.confidence)).toBe(false)
  })

  it('does NOT auto-match a single-token name to a fuller name (Adil vs Adil Shimoye)', () => {
    const cmp = compareNames('Adil', 'Adil Shimoye')
    expect(isAutoMatch(cmp.confidence)).toBe(false)
  })

  it('keeps distinct students with a shared given name apart (Ayan Abdirazak vs Ayan Ibrahim)', () => {
    const cmp = compareNames('Ayan Abdirazak', 'Ayan Ibrahim')
    expect(isAutoMatch(cmp.confidence)).toBe(false)
  })

  it('keeps distinct students with a shared father name apart (Muntaha Ismail vs Ismail Ibrahim)', () => {
    const cmp = compareNames('Muntaha Ismail', 'Ismail Ibrahim')
    expect(isAutoMatch(cmp.confidence)).toBe(false)
  })

  it('does NOT confuse a new student with a near-named sibling (Umeyr Somane vs Ubeyd Somane)', () => {
    const cmp = compareNames('Umeyr Somane', 'Ubeyd Somane')
    expect(isAutoMatch(cmp.confidence)).toBe(false)
  })

  it('does NOT auto-match the Muhumed/Mohomed transliteration (too far for fuzzy)', () => {
    // "Walid Muhumed" vs "Walid Mohomed" are the same child per the owner, but the
    // edit distance is beyond the conservative threshold — hence a CONFIRMED_ALIAS.
    expect(
      isAutoMatch(compareNames('Walid Muhumed', 'Walid Mohomed').confidence)
    ).toBe(false)
  })
})

describe('matchName', () => {
  const roster = ['Ismail Sheikhali', 'Ismail Hassan', 'Hamse Abdi', 'Anas']

  it('picks the best candidate from a roster', () => {
    const result = matchName('Ismail ShiekhAli', roster)
    expect(result.matchName).toBe('Ismail Sheikhali')
    expect(isAutoMatch(result.confidence)).toBe(true)
  })

  it('returns no match when nobody is close enough', () => {
    const result = matchName('Khadija Warsame', roster)
    expect(result.match).toBeNull()
    expect(result.confidence).toBe('none')
  })

  it('supports a key accessor for object candidates', () => {
    const people = [
      { id: '1', name: 'Hamse Abdi' },
      { id: '2', name: 'Ismail Hassan' },
    ]
    const result = matchName('Hamse Abdi', people, (p) => p.name)
    expect(result.match?.id).toBe('1')
    expect(result.confidence).toBe('exact')
  })
})
