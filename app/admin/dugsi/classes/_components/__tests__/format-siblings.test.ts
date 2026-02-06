import { Shift } from '@prisma/client'
import { describe, it, expect } from 'vitest'

import { formatSiblings } from '../unassigned-students-section'

type Sibling = { name: string; teacherName: string; classShift: Shift }

function sib(
  name: string,
  teacherName = 'Ustadh Ali',
  classShift: Shift = 'MORNING'
): Sibling {
  return { name, teacherName, classShift }
}

describe('formatSiblings', () => {
  describe('basic formatting', () => {
    it('shows a single sibling with teacher and shift', () => {
      const result = formatSiblings('Ahmed Hassan', [sib('Fatima Hassan')])
      expect(result).toBe('Fatima (Ustadh, AM)')
    })

    it('shows two siblings in the same class', () => {
      const result = formatSiblings('Ahmed Hassan', [
        sib('Fatima Hassan'),
        sib('Omar Hassan'),
      ])
      expect(result).toBe('Fatima, Omar (Ustadh, AM)')
    })

    it('truncates after MAX_SIBLINGS_SHOWN and shows +N more', () => {
      const result = formatSiblings('Ahmed Hassan', [
        sib('Fatima Hassan'),
        sib('Omar Hassan'),
        sib('Aisha Hassan'),
      ])
      expect(result).toBe('Fatima, Omar (Ustadh, AM) +1 more')
    })
  })

  describe('name abbreviation', () => {
    it('abbreviates to first name when sibling shares last name', () => {
      const result = formatSiblings('Ahmed Hassan', [sib('Fatima Hassan')])
      expect(result).toBe('Fatima (Ustadh, AM)')
    })

    it('shows full name when sibling has a different last name', () => {
      const result = formatSiblings('Ahmed Hassan', [sib('Fatima Ali')])
      expect(result).toBe('Fatima Ali (Ustadh, AM)')
    })
  })

  describe('single-word names', () => {
    it('handles single-word student name without errors', () => {
      const result = formatSiblings('Ahmed', [sib('Fatima')])
      expect(result).toBe('Fatima (Ustadh, AM)')
    })

    it('shows full sibling name when student has single-word name and sibling has last name', () => {
      const result = formatSiblings('Ahmed', [sib('Fatima Hassan')])
      expect(result).toBe('Fatima Hassan (Ustadh, AM)')
    })

    it('handles both student and sibling with single-word names', () => {
      const result = formatSiblings('Ahmed', [sib('Fatima'), sib('Omar')])
      expect(result).toBe('Fatima, Omar (Ustadh, AM)')
    })
  })

  describe('shift grouping', () => {
    it('groups siblings by teacher and shift', () => {
      const result = formatSiblings('Ahmed Hassan', [
        sib('Fatima Hassan', 'Ustadh Ali', 'MORNING'),
        sib('Omar Hassan', 'Ustadh Khalid', 'AFTERNOON'),
      ])
      expect(result).toBe('Fatima (Ustadh, AM), Omar (Ustadh, PM)')
    })

    it('shows PM for afternoon shift', () => {
      const result = formatSiblings('Ahmed Hassan', [
        sib('Fatima Hassan', 'Ustadh Ali', 'AFTERNOON'),
      ])
      expect(result).toBe('Fatima (Ustadh, PM)')
    })
  })

  describe('truncation', () => {
    it('shows +N more for siblings beyond the display limit', () => {
      const result = formatSiblings('Ahmed Hassan', [
        sib('Fatima Hassan', 'Ustadh Ali', 'MORNING'),
        sib('Omar Hassan', 'Ustadh Ali', 'MORNING'),
        sib('Aisha Hassan', 'Ustadh Ali', 'MORNING'),
        sib('Khalid Hassan', 'Ustadh Ali', 'MORNING'),
      ])
      expect(result).toBe('Fatima, Omar (Ustadh, AM) +2 more')
    })

    it('returns no suffix when siblings fit within limit', () => {
      const result = formatSiblings('Ahmed Hassan', [
        sib('Fatima Hassan'),
        sib('Omar Hassan'),
      ])
      expect(result).not.toContain('+')
    })
  })

  describe('edge cases', () => {
    it('handles empty siblings array', () => {
      const result = formatSiblings('Ahmed Hassan', [])
      expect(result).toBe('')
    })

    it('handles multi-part last names', () => {
      const result = formatSiblings('Ahmed bin Ali Hassan', [
        sib('Fatima bin Ali Hassan'),
      ])
      expect(result).toBe('Fatima (Ustadh, AM)')
    })
  })
})
