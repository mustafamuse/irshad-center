import { Shift } from '@prisma/client'

import { prisma } from '@/lib/db'
import { runScript } from './lib/run-script'

/**
 * Generate a fresh Dugsi attendance workbook from the database.
 *
 * Reads each active class + its enrolled students and CREATES a new Google
 * Spreadsheet with one tab per class+shift (named by the teacher's first name +
 * shift, e.g. "Mustafa (AM)"), pre-filled with that class's roster in canonical
 * DB spelling and the same fixed column headers as the current sheet, with blank
 * attendance marks. The existing sheet is never touched.
 *
 * Islamic Studies (Hamza Hassan) is skipped — it's a cross-class overlay with no
 * DugsiClassEnrollment rows.
 *
 * DRY-RUN BY DEFAULT (prints planned tabs + rosters, no API call). Pass --apply
 * to create the workbook; requires a Google token in GOOGLE_ACCESS_TOKEN:
 *   GOOGLE_ACCESS_TOKEN=$(python3 $GWS_AUTH) bunx tsx --env-file=.env.local \
 *     scripts/generate-dugsi-attendance-sheet.ts --apply
 */

const APPLY = process.argv.includes('--apply')

const SPREADSHEET_TITLE = 'Dugsi Attendance — Class Rosters'
const HEADERS = ['Name', 'P', 'UA', 'EA', 'Juz Category', 'Lesson', 'Behavior', 'Overall']

// Fixed tab order; the DB class `name` is the full teacher name, the tab title
// is the first name + shift. Islamic Studies (Hamza Hassan) intentionally absent.
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
  const firstName = className.split(' ')[0]
  return `${firstName} (${shift === Shift.MORNING ? 'AM' : 'PM'})`
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

async function sheetsApi(path: string, body: unknown): Promise<Record<string, unknown>> {
  const token = process.env.GOOGLE_ACCESS_TOKEN
  if (!token) throw new Error('GOOGLE_ACCESS_TOKEN not set (run: export GOOGLE_ACCESS_TOKEN=$(python3 $GWS_AUTH))')
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = (await res.json()) as Record<string, unknown>
  if (!res.ok) throw new Error(`Sheets API ${path} failed (${res.status}): ${JSON.stringify(json)}`)
  return json
}

async function main() {
  console.log(APPLY ? '*** APPLY MODE — CREATING NEW SPREADSHEET ***\n' : '--- DRY RUN (pass --apply to create the sheet) ---\n')

  const plans = await buildPlan()

  let total = 0
  for (const p of plans) {
    total += p.roster.length
    console.log(`[${p.title}]  ${p.className}/${p.shift}  (${p.roster.length} students)`)
    for (const name of p.roster) console.log(`    - ${name}`)
  }
  console.log(`\n${plans.length} tabs, ${total} students total. Islamic Studies (Hamza Hassan) skipped.`)

  if (!APPLY) {
    console.log('\nDry run complete. Re-run with --apply to create the new workbook.')
    return
  }

  // 1. Create the spreadsheet with all tabs in one call.
  const created = await sheetsApi('', {
    properties: { title: SPREADSHEET_TITLE },
    sheets: plans.map((p) => ({ properties: { title: p.title } })),
  })
  const spreadsheetId = created.spreadsheetId as string
  const spreadsheetUrl = created.spreadsheetUrl as string

  // 2. Write header + roster (column A names) into each tab.
  await sheetsApi(`/${spreadsheetId}/values:batchUpdate`, {
    valueInputOption: 'RAW',
    data: plans.map((p) => ({
      range: `'${p.title}'!A1`,
      values: [HEADERS, ...p.roster.map((name) => [name])],
    })),
  })

  console.log(`\n✅ Created "${SPREADSHEET_TITLE}" with ${plans.length} tabs.`)
  console.log(`URL: ${spreadsheetUrl}`)
}

runScript(main, { cleanup: () => prisma.$disconnect() })
