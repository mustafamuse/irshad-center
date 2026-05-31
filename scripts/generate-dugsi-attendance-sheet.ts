import { Shift } from '@prisma/client'

import { prisma } from '@/lib/db'
import { runScript } from './lib/run-script'

/**
 * Generate / refresh the Dugsi attendance workbook from the database.
 *
 * Layout per class tab (one tab per class+shift, titled "<FirstName> (AM|PM)"):
 *   Name | Juz Category | Lesson | Behavior | Overall | <one col per Sat & Sun>
 * Each weekend date column (Jun 1 – Dec 31 2026) header is the date (MM/DD); every
 * student x date cell is a dropdown restricted to P / A / S. Rosters use canonical
 * DB spelling. Islamic Studies (Hamza Hassan) is skipped.
 *
 * Targets the EXISTING workbook (TARGET_SPREADSHEET_ID) and replaces each tab's
 * contents, so the shared link stays valid. Read-only against the DB.
 *
 * DRY-RUN BY DEFAULT. Pass --apply to write; requires a Google token:
 *   GOOGLE_ACCESS_TOKEN=$(python3 $GWS_AUTH) bunx tsx --env-file=.env.local \
 *     scripts/generate-dugsi-attendance-sheet.ts --apply
 */

const APPLY = process.argv.includes('--apply')

// The workbook created 2026-05-30; --apply replaces its tab contents in place.
const TARGET_SPREADSHEET_ID = '1Qu6al9SCV6W2rWNHx1jRdjF4YJa5c6Vjq0j7BUNk2Ig'

const FIXED_HEADERS = ['Name', 'Juz Category', 'Lesson', 'Behavior', 'Overall']
const ATTENDANCE_OPTIONS = ['P', 'A', 'S']

// Weekend date columns: every Saturday & Sunday in this inclusive range.
const RANGE_START = { y: 2026, m: 6, d: 1 } // June 1, 2026
const RANGE_END = { y: 2026, m: 12, d: 31 } // December 31, 2026

const TAB_ORDER: { className: string; shift: Shift }[] = [
  { className: 'Mustafa Awil', shift: Shift.MORNING },
  { className: 'Mustafa Awil', shift: Shift.AFTERNOON },
  { className: 'Mohamed Ali-Daar', shift: Shift.MORNING },
  { className: 'Mohamed Ali-Daar', shift: Shift.AFTERNOON },
  { className: 'Abdiwahab Haibah', shift: Shift.MORNING },
  { className: 'Ducale Matan', shift: Shift.MORNING },
  { className: 'Suraya Mohamed', shift: Shift.AFTERNOON },
]

function tabTitle(className: string, shift: Shift): string {
  return `${className.split(' ')[0]} (${shift === Shift.MORNING ? 'AM' : 'PM'})`
}

/** Saturdays (6) and Sundays (0) in [start, end], as "MM/DD" labels in order. */
function weekendDateLabels(): string[] {
  const labels: string[] = []
  const cur = new Date(RANGE_START.y, RANGE_START.m - 1, RANGE_START.d)
  const end = new Date(RANGE_END.y, RANGE_END.m - 1, RANGE_END.d)
  while (cur <= end) {
    const day = cur.getDay()
    if (day === 6 || day === 0) {
      const mm = String(cur.getMonth() + 1).padStart(2, '0')
      const dd = String(cur.getDate()).padStart(2, '0')
      labels.push(`${mm}/${dd}`)
    }
    cur.setDate(cur.getDate() + 1)
  }
  return labels
}

interface TabPlan {
  title: string
  className: string
  shift: Shift
  roster: string[]
}

async function buildPlan(): Promise<TabPlan[]> {
  const plans: TabPlan[] = []
  for (const { className, shift } of TAB_ORDER) {
    const cls = await prisma.dugsiClass.findUnique({
      where: { name_shift: { name: className, shift } },
      select: {
        students: {
          where: { isActive: true },
          select: { programProfile: { select: { person: { select: { name: true } } } } },
        },
      },
    })
    if (!cls) throw new Error(`class not found: ${className}/${shift}`)
    const roster = cls.students
      .map((e) => e.programProfile.person.name)
      .sort((a, b) => a.localeCompare(b))
    plans.push({ title: tabTitle(className, shift), className, shift, roster })
  }
  return plans
}

async function sheetsApi(
  method: string,
  path: string,
  body?: unknown
): Promise<Record<string, unknown>> {
  const token = process.env.GOOGLE_ACCESS_TOKEN
  if (!token) throw new Error('GOOGLE_ACCESS_TOKEN not set (run: export GOOGLE_ACCESS_TOKEN=$(python3 $GWS_AUTH))')
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = (await res.json()) as Record<string, unknown>
  if (!res.ok) throw new Error(`Sheets API ${method} ${path} failed (${res.status}): ${JSON.stringify(json)}`)
  return json
}

interface SheetMeta {
  properties: { sheetId: number; title: string }
}

async function main() {
  console.log(APPLY ? '*** APPLY MODE — REPLACING WORKBOOK CONTENTS ***\n' : '--- DRY RUN (pass --apply to write) ---\n')

  const plans = await buildPlan()
  const dates = weekendDateLabels()
  const headers = [...FIXED_HEADERS, ...dates]

  let total = 0
  for (const p of plans) {
    total += p.roster.length
    console.log(`[${p.title}]  ${p.className}/${p.shift}  (${p.roster.length} students)`)
  }
  console.log(
    `\n${plans.length} tabs, ${total} students. ${dates.length} weekend date columns ` +
      `(${dates[0]} … ${dates[dates.length - 1]}). Dropdown: ${ATTENDANCE_OPTIONS.join('/')}. ` +
      `Columns/tab: ${headers.length}.`
  )

  if (!APPLY) {
    console.log('\nDry run complete. Re-run with --apply to write into the existing workbook.')
    return
  }

  // Map tab title -> sheetId (gid) for the existing workbook.
  const meta = await sheetsApi('GET', `/${TARGET_SPREADSHEET_ID}?fields=sheets.properties(sheetId,title)`)
  const idByTitle = new Map<string, number>(
    (meta.sheets as SheetMeta[]).map((s) => [s.properties.title, s.properties.sheetId])
  )
  for (const p of plans) {
    if (!idByTitle.has(p.title)) throw new Error(`tab "${p.title}" not found in target workbook`)
  }

  // Clear every target tab, then write header + roster (names in column A).
  for (const p of plans) {
    await sheetsApi('POST', `/${TARGET_SPREADSHEET_ID}/values/${encodeURIComponent(`'${p.title}'!A1:ZZ1000`)}:clear`, {})
  }
  await sheetsApi('POST', `/${TARGET_SPREADSHEET_ID}/values:batchUpdate`, {
    valueInputOption: 'RAW',
    data: plans.map((p) => ({
      range: `'${p.title}'!A1`,
      values: [headers, ...p.roster.map((name) => [name])],
    })),
  })

  // Dropdown (P/A/S) on every student x date cell. Date columns start at index 5
  // (0-based, after the 5 fixed columns); rows 1..rosterLen (0-based, skipping header).
  const requests = plans.map((p) => ({
    setDataValidation: {
      range: {
        sheetId: idByTitle.get(p.title)!,
        startRowIndex: 1,
        endRowIndex: 1 + p.roster.length,
        startColumnIndex: FIXED_HEADERS.length,
        endColumnIndex: FIXED_HEADERS.length + dates.length,
      },
      rule: {
        condition: {
          type: 'ONE_OF_LIST',
          values: ATTENDANCE_OPTIONS.map((v) => ({ userEnteredValue: v })),
        },
        showCustomUi: true,
        strict: true,
      },
    },
  }))
  await sheetsApi('POST', `/${TARGET_SPREADSHEET_ID}:batchUpdate`, { requests })

  console.log(`\n✅ Replaced ${plans.length} tabs with the dated attendance layout (${dates.length} weekend columns, P/A/S dropdowns).`)
  console.log(`URL: https://docs.google.com/spreadsheets/d/${TARGET_SPREADSHEET_ID}/edit`)
}

runScript(main, { cleanup: () => prisma.$disconnect() })
