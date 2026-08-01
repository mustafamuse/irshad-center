import { Program, Shift } from '@prisma/client'
import { readFile, writeFile } from 'node:fs/promises'

import { prisma } from '@/lib/db'
import {
  isAutoMatch,
  matchName,
  normalizeName,
  type MatchConfidence,
} from '@/lib/utils/dugsi-name-match'

import {
  CONFIRMED_ALIASES,
  RECONCILE_REPORT_PATH,
  ROSTER_SNAPSHOT_PATH,
  TAB_MAPPINGS,
  type AttendanceRosterSnapshot,
  type TabMapping,
} from './config/dugsi-attendance-mapping'
import { runScript } from './lib/run-script'

/**
 * Read-only reconciliation of the Dugsi attendance sheet against enrolled
 * DUGSI students. Makes NO database writes. See the Stage-1 plan.
 */

interface DugsiStudent {
  profileId: string
  personId: string
  name: string
  className: string | null
  shift: Shift | null
}

interface SheetMatch {
  sheetName: string
  dbName: string | null
  profileId?: string | null
  confidence: MatchConfidence
  score: number
  className?: string | null
  classShift?: Shift | null
}

interface TabReport {
  tab: string
  teacherName: string
  mode: TabMapping['mode']
  dbClass: TabMapping['dbClass']
  sheetCount: number
  dbClassCount: number
  matched: SheetMatch[]
  inSheetNotInClass: SheetMatch[]
  inSheetNotInDb: string[]
  inDbNotInSheet: string[]
  needsReview: SheetMatch[]
}

async function loadSnapshot(path: string): Promise<AttendanceRosterSnapshot> {
  const raw = await readFile(path, 'utf8')
  return JSON.parse(raw) as AttendanceRosterSnapshot
}

async function loadDugsiStudents(): Promise<DugsiStudent[]> {
  const profiles = await prisma.programProfile.findMany({
    where: { program: Program.DUGSI_PROGRAM },
    select: {
      id: true,
      person: { select: { id: true, name: true } },
      dugsiClassEnrollment: {
        select: {
          isActive: true,
          class: { select: { name: true, shift: true } },
        },
      },
    },
  })

  return profiles.map((p) => {
    const enrollment = p.dugsiClassEnrollment
    const active = enrollment?.isActive ? enrollment : null
    return {
      profileId: p.id,
      personId: p.person.id,
      name: p.person.name,
      className: active?.class.name ?? null,
      shift: active?.class.shift ?? null,
    }
  })
}

function reconcileTab(
  mapping: TabMapping,
  sheetStudents: string[],
  allStudents: DugsiStudent[]
): TabReport {
  const report: TabReport = {
    tab: mapping.tab,
    teacherName: mapping.teacherName,
    mode: mapping.mode,
    dbClass: mapping.dbClass,
    sheetCount: sheetStudents.length,
    dbClassCount: 0,
    matched: [],
    inSheetNotInClass: [],
    inSheetNotInDb: [],
    inDbNotInSheet: [],
    needsReview: [],
  }

  const classRoster =
    mapping.mode === 'class' && mapping.dbClass
      ? allStudents.filter(
          (s) =>
            s.className === mapping.dbClass!.name &&
            s.shift === mapping.dbClass!.shift
        )
      : []
  report.dbClassCount = classRoster.length

  const matchedProfileIds = new Set<string>()

  for (const sheetName of sheetStudents) {
    // Human-confirmed alias: resolve directly to the canonical DB student,
    // bypassing fuzzy matching + review. Only applies when the target exists.
    const aliasTarget = CONFIRMED_ALIASES[sheetName]
    if (aliasTarget) {
      const canonical = normalizeName(aliasTarget)
      const student = allStudents.find(
        (s) => normalizeName(s.name) === canonical
      )
      if (student) {
        matchedProfileIds.add(student.profileId)
        const hit: SheetMatch = {
          sheetName,
          dbName: student.name,
          profileId: student.profileId,
          confidence: 'exact',
          score: 1,
          className: student.className,
          classShift: student.shift,
        }
        const inThisClass =
          mapping.mode === 'class' &&
          mapping.dbClass != null &&
          student.className === mapping.dbClass.name &&
          student.shift === mapping.dbClass.shift
        if (mapping.mode !== 'class' || inThisClass) {
          report.matched.push(hit)
        } else {
          report.inSheetNotInClass.push(hit)
        }
        continue
      }
      // Target not found in DB → fall through so it surfaces normally.
    }

    if (mapping.mode === 'class') {
      const inClass = matchName(sheetName, classRoster, (s) => s.name)
      if (inClass.match && isAutoMatch(inClass.confidence)) {
        matchedProfileIds.add(inClass.match.profileId)
        report.matched.push({
          sheetName,
          dbName: inClass.matchName,
          profileId: inClass.match.profileId,
          confidence: inClass.confidence,
          score: inClass.score,
        })
        continue
      }
    }

    // Not confidently in this class (or unassigned/existence mode):
    // fall back to a whole-DUGSI search.
    const global = matchName(sheetName, allStudents, (s) => s.name)

    if (global.match && isAutoMatch(global.confidence)) {
      const hit: SheetMatch = {
        sheetName,
        dbName: global.matchName,
        profileId: global.match.profileId,
        confidence: global.confidence,
        score: global.score,
        className: global.match.className,
        classShift: global.match.shift,
      }
      if (mapping.mode === 'class') {
        report.inSheetNotInClass.push(hit)
      } else {
        report.matched.push(hit)
      }
    } else if (global.confidence === 'low') {
      report.needsReview.push({
        sheetName,
        dbName: global.matchName,
        confidence: global.confidence,
        score: global.score,
        className: global.match?.className,
        classShift: global.match?.shift,
      })
    } else {
      report.inSheetNotInDb.push(sheetName)
    }
  }

  if (mapping.mode === 'class') {
    report.inDbNotInSheet = classRoster
      .filter((s) => !matchedProfileIds.has(s.profileId))
      .map((s) => s.name)
  }

  return report
}

function printTab(r: TabReport): void {
  const cls = r.dbClass ? `${r.dbClass.name}/${r.dbClass.shift}` : '—'
  console.log(
    `\n=== ${r.tab}  [${r.mode}]  teacher=${r.teacherName}  class=${cls} ===`
  )
  console.log(`sheet: ${r.sheetCount}   db-class enrolled: ${r.dbClassCount}`)

  if (r.matched.length) {
    console.log(`\n  ✓ matched (${r.matched.length})`)
    for (const m of r.matched) {
      const where =
        m.className != null ? `  [db class ${m.className}/${m.classShift}]` : ''
      const named = m.dbName && m.dbName !== m.sheetName ? ` → ${m.dbName}` : ''
      console.log(`    - ${m.sheetName}${named} (${m.confidence})${where}`)
    }
  }

  if (r.inSheetNotInClass.length) {
    console.log(
      `\n  ⚠ in sheet, enrolled in a DIFFERENT class (${r.inSheetNotInClass.length})`
    )
    for (const m of r.inSheetNotInClass) {
      console.log(
        `    - ${m.sheetName} → ${m.dbName} [${m.className}/${m.classShift}]`
      )
    }
  }

  if (r.inSheetNotInDb.length) {
    console.log(
      `\n  ✗ in sheet, NO DUGSI match in DB (${r.inSheetNotInDb.length})`
    )
    for (const name of r.inSheetNotInDb) console.log(`    - ${name}`)
  }

  if (r.inDbNotInSheet.length) {
    console.log(
      `\n  ▷ enrolled in DB class, NOT on attendance sheet (${r.inDbNotInSheet.length})`
    )
    for (const name of r.inDbNotInSheet) console.log(`    - ${name}`)
  }

  if (r.needsReview.length) {
    console.log(`\n  ? needs manual review (${r.needsReview.length})`)
    for (const m of r.needsReview) {
      const guess = m.dbName
        ? ` (closest: ${m.dbName}, ${m.score.toFixed(2)})`
        : ''
      console.log(`    - ${m.sheetName}${guess}`)
    }
  }
}

async function main() {
  const snapshotPath = process.argv[2] ?? ROSTER_SNAPSHOT_PATH
  const snapshot = await loadSnapshot(snapshotPath)
  const allStudents = await loadDugsiStudents()

  console.log(
    `Reconciling ${snapshot.tabs.length} tabs against ${allStudents.length} DUGSI students (snapshot ${snapshot.fetchedAt})`
  )

  const tabByName = new Map(snapshot.tabs.map((t) => [t.tab, t.students]))
  const reports: TabReport[] = []

  for (const mapping of TAB_MAPPINGS) {
    const sheetStudents = tabByName.get(mapping.tab) ?? []
    const report = reconcileTab(mapping, sheetStudents, allStudents)
    reports.push(report)
    printTab(report)
  }

  // Global: DUGSI students never matched by any sheet name. Keyed by profileId
  // (not name) so duplicate names, e.g. two "Khalid Ibrahim", don't false-negative.
  const matchedProfileIds = new Set<string>()
  for (const r of reports) {
    for (const m of [...r.matched, ...r.inSheetNotInClass]) {
      if (m.profileId) matchedProfileIds.add(m.profileId)
    }
  }
  const notInAnySheet = allStudents.filter(
    (s) => !matchedProfileIds.has(s.profileId)
  )

  console.log(
    `\n=== GLOBAL: DUGSI students not found on ANY attendance tab (${notInAnySheet.length}/${allStudents.length}) ===`
  )
  for (const s of notInAnySheet) {
    const cls = s.className ? `${s.className}/${s.shift}` : 'UNASSIGNED'
    console.log(`    - ${s.name}  [${cls}]`)
  }

  console.log('\n=== SUMMARY ===')
  for (const r of reports) {
    console.log(
      `${r.tab.padEnd(26)} matched=${r.matched.length} diffClass=${r.inSheetNotInClass.length} noDb=${r.inSheetNotInDb.length} dbOnly=${r.inDbNotInSheet.length} review=${r.needsReview.length}`
    )
  }

  await writeFile(
    RECONCILE_REPORT_PATH,
    JSON.stringify(
      { generatedAt: new Date().toISOString(), reports, notInAnySheet },
      null,
      2
    )
  )
  console.log(`\nWrote ${RECONCILE_REPORT_PATH}`)
}

runScript(main, { cleanup: () => prisma.$disconnect() })
