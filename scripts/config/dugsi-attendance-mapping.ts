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
    dbClass: { name: 'Mustafa Awil', shift: Shift.MORNING },
    mode: 'class',
  },
  {
    tab: 'Ducale [Morning]',
    teacherName: 'Ducale Matan',
    dbClass: { name: 'Ducale Matan', shift: Shift.MORNING },
    mode: 'class',
  },
  {
    tab: 'Mohamed [Morning]',
    teacherName: 'Mohamed Ali-Daar',
    dbClass: { name: 'Mohamed Ali-Daar', shift: Shift.MORNING },
    mode: 'class',
  },
  {
    tab: 'Abdiwahab [Morning]',
    teacherName: 'Abdiwahab Haibah',
    dbClass: { name: 'Abdiwahab Haibah', shift: Shift.MORNING },
    mode: 'class',
  },
  {
    tab: 'Suraya [Afternoon]',
    teacherName: 'Suraya Mohamed',
    dbClass: { name: 'Suraya Mohamed', shift: Shift.AFTERNOON },
    mode: 'class',
  },
  {
    // Sheet tab is still labeled "Abdirahim", but he no longer teaches; the
    // class is now taught by (and named after) Mohamed Ali-Daar.
    tab: 'Abdirahim [Afternooon]',
    teacherName: 'Mohamed Ali-Daar',
    dbClass: { name: 'Mohamed Ali-Daar', shift: Shift.AFTERNOON },
    mode: 'class',
  },
  {
    // Sheet tab is labeled "Zaki", but this is the attendance sheet for the
    // existing 101/Afternoon class taught by Mustafa Awil (confirmed 2026-05-30).
    tab: 'Zaki [Afternoon]',
    teacherName: 'Mustafa Awil',
    dbClass: { name: 'Mustafa Awil', shift: Shift.AFTERNOON },
    mode: 'class',
  },
  {
    tab: 'Hamza[Islamic Studies]',
    teacherName: 'Hamza Hassan',
    dbClass: null,
    mode: 'existence',
  },
] as const

/**
 * Human-confirmed same-student aliases: attendance-sheet name → canonical DB name.
 *
 * These were verified one-by-one with the program owner during the 2026-05-30
 * reconciliation. They are deliberately NOT folded into the fuzzy matcher — the
 * matcher stays conservative and (correctly) refuses to auto-merge names with
 * different father-name tokens (e.g. "Adan Gelle" vs "Adan Ogle"). The override
 * lives here so reconcile re-runs resolve these directly instead of re-surfacing
 * them as "needs review" every time.
 *
 * Only include pairs whose DB target ALREADY EXISTS. Pending-registration names
 * (e.g. "Abdullahi Sh Nuur" → Abdullahi Ismail) are added after they're created.
 */
export const CONFIRMED_ALIASES: Readonly<Record<string, string>> = {
  'Suhayla Ali': 'Suheila Ali',
  'Affifa Shimoyali': 'Affifa Shimoye',
  'Walid Muhumed': 'Walid Mohomed',
  'Warda Muhumed': 'Warda Mohomed',
  'Mohamed-Amin': 'Mohamedamin Mohamed',
  'Ismail Sheikhali': 'Ismail Shiekh Ali',
  'Adan Gelle': 'Adan Ogle',
  Adil: 'Adil Shimoye',
  'Mohamed Mohamed': 'Mohammad Mohammad', // now enrolled in 101/Afternoon
}

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
