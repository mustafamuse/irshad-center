import { Shift } from '@prisma/client'

import { prisma } from '@/lib/db'
import { runScript } from './lib/run-script'

/**
 * Generate / refresh the Dugsi attendance workbook from the database.
 *
 * Layout per class tab (one tab per class+shift, titled "<FirstName> (AM|PM)"):
 *   Name | Juz Category | Lesson | Behavior | Present | Overall | <Sat/Sun cols>
 * - Present = COUNTIF(dates,"P")  (live count of present days)
 * - Overall = P / total-marked    (live %, S counts as absent), percent-formatted
 *   and color-coded: green >= 85%, yellow 70-84%, red < 70%.
 * - Each weekend date column (Jun 1 - Dec 31 2026, MM/DD header) has a strict
 *   P / A / S dropdown on every student cell.
 * Rosters use canonical DB spelling. Islamic Studies (Hamza Hassan) is skipped.
 *
 * Name column, header row, and the Present/Overall formula columns are locked
 * (protected ranges, editable only by OWNER_EMAIL); teachers keep Juz/Lesson/
 * Behavior + the date cells. Targets the EXISTING workbook (TARGET_SPREADSHEET_ID),
 * replacing each tab's contents + validation + conditional formats + protected
 * ranges so re-runs stay clean. Read-only DB.
 *
 * DRY-RUN BY DEFAULT. Pass --apply (needs GOOGLE_ACCESS_TOKEN=$(python3 $GWS_AUTH)).
 */

const APPLY = process.argv.includes('--apply')

const TARGET_SPREADSHEET_ID = '1Qu6al9SCV6W2rWNHx1jRdjF4YJa5c6Vjq0j7BUNk2Ig'

const FIXED_HEADERS = ['Name', 'Juz Category', 'Lesson', 'Behavior', 'Present', 'Overall']
const NAME_COL_INDEX = 0 // 0-based column A
const PRESENT_COL_INDEX = 4 // 0-based column E
const OVERALL_COL_INDEX = 5 // 0-based column F
const FIRST_DATE_COL_INDEX = FIXED_HEADERS.length // 0-based column G
const ATTENDANCE_OPTIONS = ['P', 'A', 'S']

// Hard-block protection: only this account may edit locked ranges; everyone else
// (link-shared teachers) is read-only on them. Editable: Juz/Lesson/Behavior + dates.
const OWNER_EMAIL = 'umpp101@gmail.com'

const RANGE_START = { y: 2026, m: 6, d: 1 }
const RANGE_END = { y: 2026, m: 12, d: 31 }

// green >= 85%, yellow 70-84%, red < 70%
const GREEN = { red: 0.717, green: 0.882, blue: 0.804 }
const YELLOW = { red: 1, green: 0.949, blue: 0.8 }
const RED = { red: 0.957, green: 0.78, blue: 0.765 }

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

/** 0-based column index → A1 letters (0→A, 25→Z, 26→AA). */
function colLetter(index: number): string {
  let n = index
  let s = ''
  do {
    s = String.fromCharCode(65 + (n % 26)) + s
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return s
}

function weekendDateLabels(): string[] {
  const labels: string[] = []
  const cur = new Date(RANGE_START.y, RANGE_START.m - 1, RANGE_START.d)
  const end = new Date(RANGE_END.y, RANGE_END.m - 1, RANGE_END.d)
  while (cur <= end) {
    const day = cur.getDay()
    if (day === 6 || day === 0) {
      labels.push(`${String(cur.getMonth() + 1).padStart(2, '0')}/${String(cur.getDate()).padStart(2, '0')}`)
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

async function sheetsApi(method: string, path: string, body?: unknown): Promise<Record<string, unknown>> {
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
  conditionalFormats?: unknown[]
  protectedRanges?: { protectedRangeId: number }[]
}

/** Lock a range to OWNER_EMAIL only (hard block for all other editors). */
function lockRange(sheetId: number, range: object, description: string) {
  return {
    addProtectedRange: {
      protectedRange: {
        range: { sheetId, ...range },
        description,
        warningOnly: false,
        editors: { users: [OWNER_EMAIL] },
      },
    },
  }
}

/** Build the fixed-column cells for one student row (1-based sheet row). */
function fixedCells(name: string, row: number, lastDateCol: string): string[] {
  const dateRange = `${colLetter(FIRST_DATE_COL_INDEX)}${row}:${lastDateCol}${row}`
  return [
    name,
    '', // Juz Category
    '', // Lesson
    '', // Behavior
    `=COUNTIF(${dateRange},"P")`, // Present
    `=IF(COUNTA(${dateRange})=0,"",COUNTIF(${dateRange},"P")/COUNTA(${dateRange}))`, // Overall %
  ]
}

function colorRule(sheetId: number, rows: number, type: string, value: string, color: object) {
  return {
    addConditionalFormatRule: {
      index: 0,
      rule: {
        ranges: [{ sheetId, startRowIndex: 1, endRowIndex: 1 + rows, startColumnIndex: OVERALL_COL_INDEX, endColumnIndex: OVERALL_COL_INDEX + 1 }],
        booleanRule: {
          condition: { type, values: [{ userEnteredValue: value }] },
          format: { backgroundColor: color },
        },
      },
    },
  }
}

async function main() {
  console.log(APPLY ? '*** APPLY MODE — REPLACING WORKBOOK CONTENTS ***\n' : '--- DRY RUN (pass --apply to write) ---\n')

  const plans = await buildPlan()
  const dates = weekendDateLabels()
  const headers = [...FIXED_HEADERS, ...dates]
  const lastDateCol = colLetter(FIRST_DATE_COL_INDEX + dates.length - 1)

  let total = 0
  for (const p of plans) {
    total += p.roster.length
    console.log(`[${p.title}]  ${p.className}/${p.shift}  (${p.roster.length} students)`)
  }
  console.log(
    `\n${plans.length} tabs, ${total} students. ${dates.length} weekend cols (${dates[0]} … ${dates[dates.length - 1]}, cols ${colLetter(FIRST_DATE_COL_INDEX)}:${lastDateCol}).` +
      `\nPresent = COUNTIF(P); Overall = P/marked (S=absent), %-formatted, green>=85 / yellow>=70 / red<70. Dropdown ${ATTENDANCE_OPTIONS.join('/')}.`
  )

  if (!APPLY) {
    console.log('\nDry run complete. Re-run with --apply to write into the existing workbook.')
    return
  }

  const meta = await sheetsApi('GET', `/${TARGET_SPREADSHEET_ID}?fields=sheets.properties(sheetId,title),sheets.conditionalFormats,sheets.protectedRanges(protectedRangeId)`)
  const sheets = meta.sheets as SheetMeta[]
  const byTitle = new Map<string, SheetMeta>(sheets.map((s) => [s.properties.title, s]))
  for (const p of plans) if (!byTitle.has(p.title)) throw new Error(`tab "${p.title}" not found in target workbook`)

  // Clear values, then write header + roster with formulas (USER_ENTERED).
  for (const p of plans) {
    await sheetsApi('POST', `/${TARGET_SPREADSHEET_ID}/values/${encodeURIComponent(`'${p.title}'!A1:ZZ1000`)}:clear`, {})
  }
  await sheetsApi('POST', `/${TARGET_SPREADSHEET_ID}/values:batchUpdate`, {
    valueInputOption: 'USER_ENTERED',
    data: plans.map((p) => ({
      range: `'${p.title}'!A1`,
      values: [headers, ...p.roster.map((name, i) => fixedCells(name, i + 2, lastDateCol))],
    })),
  })

  // Per tab: clear old validation + conditional formats, then set the new ones,
  // percent-format Overall, and color-band it.
  const requests: object[] = []
  for (const p of plans) {
    const sm = byTitle.get(p.title)!
    const sheetId = sm.properties.sheetId
    const rows = p.roster.length
    const totalCols = FIXED_HEADERS.length + dates.length

    // delete existing conditional format rules (reverse index) so re-runs don't stack
    const existing = sm.conditionalFormats?.length ?? 0
    for (let i = existing - 1; i >= 0; i--) {
      requests.push({ deleteConditionalFormatRule: { sheetId, index: i } })
    }
    // clear any prior data validation across the grid
    requests.push({
      setDataValidation: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 1 + rows, startColumnIndex: 0, endColumnIndex: totalCols },
      },
    })
    // P/A/S dropdown on the date cells
    requests.push({
      setDataValidation: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 1 + rows, startColumnIndex: FIRST_DATE_COL_INDEX, endColumnIndex: totalCols },
        rule: {
          condition: { type: 'ONE_OF_LIST', values: ATTENDANCE_OPTIONS.map((v) => ({ userEnteredValue: v })) },
          showCustomUi: true,
          strict: true,
        },
      },
    })
    // Overall as percent
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 1 + rows, startColumnIndex: OVERALL_COL_INDEX, endColumnIndex: OVERALL_COL_INDEX + 1 },
        cell: { userEnteredFormat: { numberFormat: { type: 'PERCENT', pattern: '0%' } } },
        fields: 'userEnteredFormat.numberFormat',
      },
    })
    // color bands (added at index 0 → push red first so green ends up evaluated first)
    requests.push(colorRule(sheetId, rows, 'NUMBER_LESS', '0.7', RED))
    requests.push(colorRule(sheetId, rows, 'NUMBER_GREATER_THAN_EQ', '0.7', YELLOW))
    requests.push(colorRule(sheetId, rows, 'NUMBER_GREATER_THAN_EQ', '0.85', GREEN))

    // drop existing protected ranges (re-runs would otherwise stack them)
    for (const pr of sm.protectedRanges ?? []) {
      requests.push({ deleteProtectedRange: { protectedRangeId: pr.protectedRangeId } })
    }
    // lock header row + Name/Present/Overall (formulas + identity); leave the rest editable
    requests.push(lockRange(sheetId, { startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: totalCols }, 'Header (locked)'))
    if (rows > 0) {
      const dataRows = { startRowIndex: 1, endRowIndex: 1 + rows }
      requests.push(lockRange(sheetId, { ...dataRows, startColumnIndex: NAME_COL_INDEX, endColumnIndex: NAME_COL_INDEX + 1 }, 'Name (locked)'))
      requests.push(lockRange(sheetId, { ...dataRows, startColumnIndex: PRESENT_COL_INDEX, endColumnIndex: PRESENT_COL_INDEX + 1 }, 'Present formula (locked)'))
      requests.push(lockRange(sheetId, { ...dataRows, startColumnIndex: OVERALL_COL_INDEX, endColumnIndex: OVERALL_COL_INDEX + 1 }, 'Overall formula (locked)'))
    }
  }
  await sheetsApi('POST', `/${TARGET_SPREADSHEET_ID}:batchUpdate`, { requests })

  console.log(`\n✅ Replaced ${plans.length} tabs: ${dates.length} weekend cols, P/A/S dropdowns, live Present + Overall%, color-banded, Name/header/formulas locked to ${OWNER_EMAIL}.`)
  console.log(`URL: https://docs.google.com/spreadsheets/d/${TARGET_SPREADSHEET_ID}/edit`)
}

runScript(main, { cleanup: () => prisma.$disconnect() })
