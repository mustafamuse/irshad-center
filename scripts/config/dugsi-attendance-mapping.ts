import { Shift } from '@prisma/client'

/**
 * Static configuration for Dugsi attendance ↔ DB reconciliation.
 *
 * The tab→class mapping was confirmed with the program owner (2026-05-30).
 * Teacher first names are ambiguous in the DB (two Mustafas, two Mohameds),
 * so each tab is pinned to a specific teacher + class rather than matched by
 * name. See .claude/plans/2026-05-30-dugsi-attendance-reconcile.md.
 */

export const ATTENDANCE_SHEET_ID =
  '1JiUfTbfPE9SZ1uF6aUH2qF7Drb45_BAu4dT7oAfsgzM'

/** Student name is column A; row 1 is the header. */
export const STUDENT_NAME_RANGE = 'A2:A200'

/**
 * `class`      — reconcile against the specific DB class roster.
 * `unassigned` — teacher has no DB class; report names + whole-DB existence check.
 * `existence`  — subject overlay; only verify each name exists as a DUGSI student.
 */
export type ReconcileMode = 'class' | 'unassigned' | 'existence'

export interface TabMapping {
  /** Exact sheet tab title (note the typos: "Afternooon", no space before "["). */
  tab: string
  /** Canonical DB teacher Person.name this tab belongs to. */
  teacherName: string
  /** Target DB class, or null for unassigned/existence modes. */
  dbClass: { name: string; shift: Shift } | null
  mode: ReconcileMode
}

export const TAB_MAPPINGS: readonly TabMapping[] = [
  {
    tab: 'Mustafa [Morning]',
    teacherName: 'Mustafa Awil',
    dbClass: { name: '101', shift: Shift.MORNING },
    mode: 'class',
  },
  {
    tab: 'Ducale [Morning]',
    teacherName: 'Ducale Matan',
    dbClass: { name: '105', shift: Shift.MORNING },
    mode: 'class',
  },
  {
    tab: 'Mohamed [Morning]',
    teacherName: 'Mohamed Ali-Daar',
    dbClass: { name: '103', shift: Shift.MORNING },
    mode: 'class',
  },
  {
    tab: 'Abdiwahab [Morning]',
    teacherName: 'Abdiwahab Haibah',
    dbClass: { name: '104', shift: Shift.MORNING },
    mode: 'class',
  },
  {
    tab: 'Suraya [Afternoon]',
    teacherName: 'Suraya Mohamed',
    dbClass: { name: '102', shift: Shift.AFTERNOON },
    mode: 'class',
  },
  {
    tab: 'Abdirahim [Afternooon]',
    teacherName: 'Abdirahim Haibah',
    dbClass: { name: '103', shift: Shift.AFTERNOON },
    mode: 'class',
  },
  {
    // Sheet tab is labeled "Zaki", but this is the attendance sheet for the
    // existing 101/Afternoon class taught by Mustafa Awil (confirmed 2026-05-30).
    tab: 'Zaki [Afternoon]',
    teacherName: 'Mustafa Awil',
    dbClass: { name: '101', shift: Shift.AFTERNOON },
    mode: 'class',
  },
  {
    tab: 'Hamza[Islamic Studies]',
    teacherName: 'Hamza Hassan',
    dbClass: null,
    mode: 'existence',
  },
] as const

/** Tabs intentionally excluded from reconciliation. */
export const IGNORED_TABS: readonly string[] = ['Recomended For Weekday']

export interface RosterTab {
  tab: string
  students: string[]
}

export interface AttendanceRosterSnapshot {
  sheetId: string
  fetchedAt: string
  tabs: RosterTab[]
}

export const ROSTER_SNAPSHOT_PATH = 'scripts/data/dugsi-attendance-roster.json'
export const RECONCILE_REPORT_PATH =
  'scripts/data/dugsi-reconciliation-report.json'
