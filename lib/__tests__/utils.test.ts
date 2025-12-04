import { describe, it, expect } from 'vitest'

import { capitalizeName } from '../utils'

describe('capitalizeName', () => {
  describe('basic capitalization', () => {
    it('capitalizes single word', () => {
      expect(capitalizeName('john')).toBe('John')
      expect(capitalizeName('JOHN')).toBe('John')
      expect(capitalizeName('JoHn')).toBe('John')
    })

    it('capitalizes multiple words', () => {
      expect(capitalizeName('john smith')).toBe('John Smith')
      expect(capitalizeName('mary ann jones')).toBe('Mary Ann Jones')
    })

    it('handles already capitalized names', () => {
      expect(capitalizeName('John Smith')).toBe('John Smith')
      expect(capitalizeName('Mary Ann')).toBe('Mary Ann')
    })
  })

  describe('hyphenated names', () => {
    it('capitalizes hyphenated first names', () => {
      expect(capitalizeName('mary-ann')).toBe('Mary-Ann')
      expect(capitalizeName('jean-claude')).toBe('Jean-Claude')
      expect(capitalizeName('MARY-ANN')).toBe('Mary-Ann')
    })

    it('capitalizes hyphenated last names', () => {
      expect(capitalizeName('smith-jones')).toBe('Smith-Jones')
      expect(capitalizeName('al-farsi')).toBe('Al-Farsi')
    })

    it('handles multiple hyphens', () => {
      expect(capitalizeName('mary-ann-elizabeth')).toBe('Mary-Ann-Elizabeth')
    })
  })

  describe('apostrophe names', () => {
    it('capitalizes Irish names with apostrophes', () => {
      expect(capitalizeName("o'brien")).toBe("O'Brien")
      expect(capitalizeName("o'connor")).toBe("O'Connor")
      expect(capitalizeName("O'BRIEN")).toBe("O'Brien")
    })

    it('capitalizes French names with apostrophes', () => {
      expect(capitalizeName("d'angelo")).toBe("D'Angelo")
      expect(capitalizeName("l'esperance")).toBe("L'Esperance")
    })

    it('handles possessive apostrophes at end', () => {
      expect(capitalizeName("james'")).toBe("James'")
    })

    it('normalizes Unicode apostrophe variants', () => {
      // U+2019 right single quotation mark (curly apostrophe from mobile)
      expect(capitalizeName('o\u2019brien')).toBe("O'Brien")
      expect(capitalizeName('d\u2019angelo')).toBe("D'Angelo")

      // U+02BC modifier letter apostrophe
      expect(capitalizeName('o\u02BCbrien')).toBe("O'Brien")
    })
  })

  describe('combined special characters', () => {
    it('handles names with both hyphens and apostrophes', () => {
      expect(capitalizeName("o'brien-smith")).toBe("O'Brien-Smith")
      expect(capitalizeName("mary-ann o'connor")).toBe("Mary-Ann O'Connor")
    })

    it('handles multiple special characters', () => {
      expect(capitalizeName("jean-claude d'angelo")).toBe(
        "Jean-Claude D'Angelo"
      )
    })
  })

  describe('edge cases', () => {
    it('handles empty string', () => {
      expect(capitalizeName('')).toBe('')
    })

    it('handles single character', () => {
      expect(capitalizeName('a')).toBe('A')
      expect(capitalizeName('z')).toBe('Z')
    })

    it('handles multiple spaces', () => {
      expect(capitalizeName('john  smith')).toBe('John  Smith')
      expect(capitalizeName('mary   ann')).toBe('Mary   Ann')
    })

    it('handles leading/trailing spaces', () => {
      expect(capitalizeName(' john')).toBe(' John')
      expect(capitalizeName('john ')).toBe('John ')
      expect(capitalizeName(' john ')).toBe(' John ')
    })

    it('handles names with numbers', () => {
      expect(capitalizeName('john 3rd')).toBe('John 3rd')
      expect(capitalizeName('henry viii')).toBe('Henry Viii')
    })

    it('handles special Unicode characters', () => {
      expect(capitalizeName('josé')).toBe('José')
      expect(capitalizeName('françois')).toBe('François')
      expect(capitalizeName('münchen')).toBe('München')
    })
  })

  describe('real-world names', () => {
    it('handles Somali names', () => {
      expect(capitalizeName('mohamed')).toBe('Mohamed')
      expect(capitalizeName('fatima')).toBe('Fatima')
      expect(capitalizeName('abdi-rahman')).toBe('Abdi-Rahman')
    })

    it('handles compound names', () => {
      expect(capitalizeName('von neumann')).toBe('Von Neumann')
      expect(capitalizeName('de la cruz')).toBe('De La Cruz')
      expect(capitalizeName('van der berg')).toBe('Van Der Berg')
    })

    it('handles Scottish/Irish prefixes', () => {
      expect(capitalizeName('mcdonald')).toBe('Mcdonald')
      expect(capitalizeName('macdonald')).toBe('Macdonald')
      expect(capitalizeName("o'sullivan")).toBe("O'Sullivan")
    })
  })

  describe('input validation', () => {
    it('handles whitespace-only strings', () => {
      expect(capitalizeName('   ')).toBe('   ')
      expect(capitalizeName('\t')).toBe('\t')
    })

    it('handles strings with only special characters', () => {
      expect(capitalizeName('---')).toBe('---')
      expect(capitalizeName("'''")).toBe("'''")
      expect(capitalizeName('-')).toBe('-')
    })

    it('handles very long names', () => {
      const longName = 'a'.repeat(100)
      const result = capitalizeName(longName)
      expect(result.charAt(0)).toBe('A')
      expect(result.length).toBe(100)
    })
  })
})
