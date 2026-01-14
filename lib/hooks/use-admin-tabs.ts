'use client'

import { parseAsStringLiteral, useQueryState } from 'nuqs'

export const DUGSI_TABS = [
  'families',
  'teachers',
  'classes',
  'attendance',
] as const
export type DugsiTab = (typeof DUGSI_TABS)[number]

export const DUGSI_TEACHER_SUBTABS = ['list', 'checkins', 'late'] as const
export type DugsiTeacherSubtab = (typeof DUGSI_TEACHER_SUBTABS)[number]

export const DUGSI_CLASSES_SUBTABS = ['morning', 'afternoon'] as const
export type DugsiClassesSubtab = (typeof DUGSI_CLASSES_SUBTABS)[number]

export const MAHAD_TABS = [
  'students',
  'batches',
  'payments',
  'duplicates',
] as const
export type MahadTab = (typeof MAHAD_TABS)[number]

export const FAMILY_STATUS_FILTERS = [
  'all',
  'active',
  'churned',
  'needs-attention',
  'billing-mismatch',
] as const
export type FamilyStatusFilter = (typeof FAMILY_STATUS_FILTERS)[number]

export function useDugsiTabs() {
  const [tab, setTab] = useQueryState(
    'tab',
    parseAsStringLiteral(DUGSI_TABS).withDefault('families')
  )

  const [subtab, setSubtab] = useQueryState(
    'subtab',
    parseAsStringLiteral([...DUGSI_TEACHER_SUBTABS, ...DUGSI_CLASSES_SUBTABS])
  )

  const [status, setStatus] = useQueryState(
    'status',
    parseAsStringLiteral(FAMILY_STATUS_FILTERS).withDefault('all')
  )

  return {
    tab,
    setTab,
    subtab,
    setSubtab,
    status,
    setStatus,
  }
}

export function useMahadTabs() {
  const [tab, setTab] = useQueryState(
    'tab',
    parseAsStringLiteral(MAHAD_TABS).withDefault('students')
  )

  return { tab, setTab }
}
