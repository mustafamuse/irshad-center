import { Shift } from '@prisma/client'

import { prisma } from '@/lib/db'
import { runScript } from './lib/run-script'

/**
 * Generate / refresh the Dugsi attendance workbook from the database.
 *
 * Per class tab (one tab per class+shift, titled "<FirstName> (AM|PM)"):
 *   Row 1: merged month-label band (class title over A:F, "June 2026" over each month)
 *   Row 2: Name | Juz Category | Lesson | Behavior | Present | Overall | <Sat/Sun date cols>
 *   Row 3+: one student per row, then a bold "Class average" row.
 * - Present = COUNTIF(dates,"P"); Overall = P / total-marked (S counts as absent),
 *   percent-formatted and color-banded (green >=85, yellow >=70, red <70).
 * - Date cells take a strict P/A/S dropdown and are color-coded (P green / A red / S gray).
 * - Header + Name column are frozen; Name/header/formula columns are protected
 *   (editable only by OWNER_EMAIL). Teachers keep Juz/Lesson/Behavior + date cells.
 * - A "Summary" tab rolls up each class's average attendance.
 * Rosters use canonical DB spelling. Islamic Studies (Hamza Hassan) is skipped.
 *
 * Targets the EXISTING workbook (TARGET_SPREADSHEET_ID), replacing each tab's
 * contents, validation, conditional formats, banding, merges, and protected ranges
 * so re-runs stay clean. Read-only DB.
 *
 * DRY-RUN BY DEFAULT. Pass --apply (needs GOOGLE_ACCESS_TOKEN=$(python3 $GWS_AUTH)).
 */

const APPLY = process.argv.includes('--apply')

const TARGET_SPREADSHEET_ID = '1Qu6al9SCV6W2rWNHx1jRdjF4YJa5c6Vjq0j7BUNk2Ig'

const FIXED_HEADERS = ['Name', 'Juz Category', 'Lesson', 'Behavior', 'Present', 'Overall']
const NAME_COL_INDEX = 0 // A
const PRESENT_COL_INDEX = 4 // E
const OVERALL_COL_INDEX = 5 // F
const FIRST_DATE_COL_INDEX = FIXED_HEADERS.length // G
const ATTENDANCE_OPTIONS = ['P', 'A', 'S']

// Two header rows: month band (row 1 / index 0) + column headers (row 2 / index 1).
const BAND_ROW = 0
const HEADER_ROW = 1
const FIRST_DATA_ROW = 2 // 0-based; 1-based row 3

const RANGE_START = { y: 2026, m: 6, d: 1 }
const RANGE_END = { y: 2026, m: 12, d: 31 }

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// Hard-block protection: only this account may edit locked ranges.
const OWNER_EMAIL = 'umpp101@gmail.com'

// Palette
const HEADER_BG = { red: 0.2, green: 0.25, blue: 0.33 }
const BAND_BG = { red: 0.27, green: 0.35, blue: 0.46 }
const WHITE = { red: 1, green: 1, blue: 1 }
const DARK_TEXT = { red: 0.13, green: 0.15, blue: 0.18 }
const SAT_HDR = { red: 0.81, green: 0.89, blue: 0.95 }
const SUN_HDR = { red: 0.93, green: 0.87, blue: 0.96 }
const MARK_P = { red: 0.85, green: 0.93, blue: 0.83 }
const MARK_A = { red: 0.98, green: 0.82, blue: 0.8 }
const MARK_S = { red: 0.9, green: 0.9, blue: 0.9 }
const GREEN = { red: 0.717, green: 0.882, blue: 0.804 }
const YELLOW = { red: 1, green: 0.949, blue: 0.8 }
const RED = { red: 0.957, green: 0.78, blue: 0.765 }
const ZEBRA = { red: 0.96, green: 0.96, blue: 0.96 }
const AVG_BG = { red: 0.9, green: 0.92, blue: 0.95 }

const SUMMARY_TAB = 'Summary'

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

interface WeekendDay {
  label: string // "06/06 Sa"
  month: number // 1-based
  year: number
  isSat: boolean
}

function weekendDays(): WeekendDay[] {
  const out: WeekendDay[] = []
  const cur = new Date(RANGE_START.y, RANGE_START.m - 1, RANGE_START.d)
  const end = new Date(RANGE_END.y, RANGE_END.m - 1, RANGE_END.d)
  while (cur <= end) {
    const day = cur.getDay()
    if (day === 6 || day === 0) {
      const mm = String(cur.getMonth() + 1).padStart(2, '0')
      const dd = String(cur.getDate()).padStart(2, '0')
      out.push({ label: `${mm}/${dd} ${day === 6 ? 'Sa' : 'Su'}`, month: cur.getMonth() + 1, year: cur.getFullYear(), isSat: day === 6 })
    }
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

interface MonthBand {
  label: string
  start: number // 0-based offset into the date array
  end: number // inclusive
}

function monthBands(days: WeekendDay[]): MonthBand[] {
  const bands: MonthBand[] = []
  for (let i = 0; i < days.length; i++) {
    const last = bands[bands.length - 1]
    const label = `${MONTH_NAMES[days[i].month - 1]} ${days[i].year}`
    if (last && last.label === label) last.end = i
    else bands.push({ label, start: i, end: i })
  }
  return bands
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
  bandedRanges?: { bandedRangeId: number }[]
  tables?: { tableId: string }[]
}

type Color = { red: number; green: number; blue: number }
type GridRange = { startRowIndex?: number; endRowIndex?: number; startColumnIndex?: number; endColumnIndex?: number }

/** repeatCell helper that sets a precise set of cell-format aspects. */
function styleCells(
  sheetId: number,
  range: GridRange,
  opts: { bg?: Color; bold?: boolean; textColor?: Color; hAlign?: 'LEFT' | 'CENTER' | 'RIGHT' }
) {
  const fmt: Record<string, unknown> = {}
  const fields: string[] = []
  if (opts.bg) {
    fmt.backgroundColor = opts.bg
    fields.push('userEnteredFormat.backgroundColor')
  }
  if (opts.bold !== undefined || opts.textColor) {
    const tf: Record<string, unknown> = {}
    if (opts.bold !== undefined) tf.bold = opts.bold
    if (opts.textColor) tf.foregroundColor = opts.textColor
    fmt.textFormat = tf
    fields.push('userEnteredFormat.textFormat')
  }
  if (opts.hAlign) {
    fmt.horizontalAlignment = opts.hAlign
    fields.push('userEnteredFormat.horizontalAlignment')
  }
  return { repeatCell: { range: { sheetId, ...range }, cell: { userEnteredFormat: fmt }, fields: fields.join(',') } }
}

function noteCell(sheetId: number, row: number, col: number, note: string) {
  return {
    repeatCell: {
      range: { sheetId, startRowIndex: row, endRowIndex: row + 1, startColumnIndex: col, endColumnIndex: col + 1 },
      cell: { note },
      fields: 'note',
    },
  }
}

function lockRange(sheetId: number, range: GridRange, description: string) {
  return {
    addProtectedRange: {
      protectedRange: { range: { sheetId, ...range }, description, warningOnly: false, editors: { users: [OWNER_EMAIL] } },
    },
  }
}

function numberCondRule(sheetId: number, range: GridRange, type: string, value: string, color: Color) {
  return {
    addConditionalFormatRule: {
      index: 0,
      rule: { ranges: [{ sheetId, ...range }], booleanRule: { condition: { type, values: [{ userEnteredValue: value }] }, format: { backgroundColor: color } } },
    },
  }
}

function textEqRule(sheetId: number, range: GridRange, text: string, color: Color) {
  return {
    addConditionalFormatRule: {
      index: 0,
      rule: { ranges: [{ sheetId, ...range }], booleanRule: { condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: text }] }, format: { backgroundColor: color } } },
    },
  }
}

function colWidth(sheetId: number, startCol: number, endCol: number, px: number) {
  return {
    updateDimensionProperties: {
      range: { sheetId, dimension: 'COLUMNS', startIndex: startCol, endIndex: endCol },
      properties: { pixelSize: px },
      fields: 'pixelSize',
    },
  }
}

/** Fixed-column cells for one student row (1-based sheet row). */
function fixedCells(name: string, row: number, lastDateCol: string): string[] {
  const dr = `${colLetter(FIRST_DATE_COL_INDEX)}${row}:${lastDateCol}${row}`
  return [name, '', '', '', `=COUNTIF(${dr},"P")`, `=IF(COUNTA(${dr})=0,"",COUNTIF(${dr},"P")/COUNTA(${dr}))`]
}

const META_FIELDS = 'sheets.properties(sheetId,title),sheets.conditionalFormats,sheets.protectedRanges(protectedRangeId),sheets.bandedRanges(bandedRangeId),sheets.tables(tableId)'

async function fetchMeta(): Promise<Map<string, SheetMeta>> {
  const meta = await sheetsApi('GET', `/${TARGET_SPREADSHEET_ID}?fields=${META_FIELDS}`)
  return new Map((meta.sheets as SheetMeta[]).map((s) => [s.properties.title, s]))
}

async function applyTabs(plans: TabPlan[], days: WeekendDay[]) {
  const bands = monthBands(days)
  const totalCols = FIXED_HEADERS.length + days.length
  const lastDateCol = colLetter(FIRST_DATE_COL_INDEX + days.length - 1)
  const headerRow = [...FIXED_HEADERS, ...days.map((d) => d.label)]

  let byTitle = await fetchMeta()
  // Tables block cell-merges and own their own conditional formats; delete them in
  // a standalone batch first, then re-read so CF/banding/protected counts are fresh.
  const tableDeletes = plans.flatMap((p) => (byTitle.get(p.title)!.tables ?? []).map((t) => ({ deleteTable: { tableId: t.tableId } })))
  if (tableDeletes.length) {
    await sheetsApi('POST', `/${TARGET_SPREADSHEET_ID}:batchUpdate`, { requests: tableDeletes })
    byTitle = await fetchMeta()
  }

  // Values (USER_ENTERED so formulas evaluate).
  for (const p of plans) {
    await sheetsApi('POST', `/${TARGET_SPREADSHEET_ID}/values/${encodeURIComponent(`'${p.title}'!A1:ZZ1000`)}:clear`, {})
  }
  await sheetsApi('POST', `/${TARGET_SPREADSHEET_ID}/values:batchUpdate`, {
    valueInputOption: 'USER_ENTERED',
    data: plans.map((p) => {
      const band: string[] = Array(totalCols).fill('')
      band[0] = `${p.className} — ${p.shift === Shift.MORNING ? 'AM' : 'PM'}`
      for (const b of bands) band[FIRST_DATE_COL_INDEX + b.start] = b.label
      const students = p.roster.map((name, i) => fixedCells(name, FIRST_DATA_ROW + 1 + i, lastDateCol))
      const lastStudent = FIRST_DATA_ROW + p.roster.length // 1-based last student row
      const avg = ['Class average', '', '', '', `=SUM(E${FIRST_DATA_ROW + 1}:E${lastStudent})`, `=IFERROR(AVERAGE(F${FIRST_DATA_ROW + 1}:F${lastStudent}),"")`]
      return { range: `'${p.title}'!A1`, values: [band, headerRow, ...students, avg] }
    }),
  })

  const requests: object[] = []
  for (const p of plans) {
    const sm = byTitle.get(p.title)!
    const sheetId = sm.properties.sheetId
    const rows = p.roster.length
    const dataEnd = FIRST_DATA_ROW + rows // exclusive end of student rows
    const avgEnd = dataEnd + 1 // include the class-average row

    // 1. Freeze header rows + the fixed columns.
    requests.push({
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 2, frozenColumnCount: FIXED_HEADERS.length } },
        fields: 'gridProperties.frozenRowCount,gridProperties.frozenColumnCount',
      },
    })
    // 2. Column widths: narrow dates, wider Name.
    requests.push(colWidth(sheetId, FIRST_DATE_COL_INDEX, totalCols, 42))
    requests.push(colWidth(sheetId, NAME_COL_INDEX, NAME_COL_INDEX + 1, 170))

    // Clear then re-create merges for the month band.
    requests.push({ unmergeCells: { range: { sheetId, startRowIndex: 0, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: totalCols } } })
    requests.push({ mergeCells: { range: { sheetId, startRowIndex: BAND_ROW, endRowIndex: BAND_ROW + 1, startColumnIndex: 0, endColumnIndex: FIXED_HEADERS.length }, mergeType: 'MERGE_ALL' } })
    for (const b of bands) {
      requests.push({ mergeCells: { range: { sheetId, startRowIndex: BAND_ROW, endRowIndex: BAND_ROW + 1, startColumnIndex: FIRST_DATE_COL_INDEX + b.start, endColumnIndex: FIRST_DATE_COL_INDEX + b.end + 1 }, mergeType: 'MERGE_ALL' } })
    }

    // Drop stacking artifacts from prior runs.
    for (let i = (sm.conditionalFormats?.length ?? 0) - 1; i >= 0; i--) requests.push({ deleteConditionalFormatRule: { sheetId, index: i } })
    for (const br of sm.bandedRanges ?? []) requests.push({ deleteBanding: { bandedRangeId: br.bandedRangeId } })
    for (const pr of sm.protectedRanges ?? []) requests.push({ deleteProtectedRange: { protectedRangeId: pr.protectedRangeId } })

    // Data validation: clear the whole grid (incl. header rows + any stale validation
    // left by a prior layout), then set the P/A/S dropdown on date cells only.
    requests.push({ setDataValidation: { range: { sheetId, startRowIndex: 0, endRowIndex: 1000, startColumnIndex: 0, endColumnIndex: totalCols } } })
    requests.push({
      setDataValidation: {
        range: { sheetId, startRowIndex: FIRST_DATA_ROW, endRowIndex: dataEnd, startColumnIndex: FIRST_DATE_COL_INDEX, endColumnIndex: totalCols },
        rule: { condition: { type: 'ONE_OF_LIST', values: ATTENDANCE_OPTIONS.map((v) => ({ userEnteredValue: v })) }, showCustomUi: true, strict: true },
      },
    })

    // Number format + alignment.
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: FIRST_DATA_ROW, endRowIndex: avgEnd, startColumnIndex: OVERALL_COL_INDEX, endColumnIndex: OVERALL_COL_INDEX + 1 },
        cell: { userEnteredFormat: { numberFormat: { type: 'PERCENT', pattern: '0%' } } },
        fields: 'userEnteredFormat.numberFormat',
      },
    })
    requests.push(styleCells(sheetId, { startRowIndex: HEADER_ROW, endRowIndex: avgEnd, startColumnIndex: FIRST_DATE_COL_INDEX, endColumnIndex: totalCols }, { hAlign: 'CENTER' }))

    // Header styling: month band, fixed headers, date headers (Sat base; Sun overridden).
    requests.push(styleCells(sheetId, { startRowIndex: BAND_ROW, endRowIndex: BAND_ROW + 1, startColumnIndex: 0, endColumnIndex: totalCols }, { bg: BAND_BG, bold: true, textColor: WHITE, hAlign: 'CENTER' }))
    requests.push(styleCells(sheetId, { startRowIndex: HEADER_ROW, endRowIndex: HEADER_ROW + 1, startColumnIndex: 0, endColumnIndex: FIXED_HEADERS.length }, { bg: HEADER_BG, bold: true, textColor: WHITE, hAlign: 'CENTER' }))
    requests.push(styleCells(sheetId, { startRowIndex: HEADER_ROW, endRowIndex: HEADER_ROW + 1, startColumnIndex: FIRST_DATE_COL_INDEX, endColumnIndex: totalCols }, { bg: SAT_HDR, bold: true, textColor: DARK_TEXT, hAlign: 'CENTER' }))
    days.forEach((d, i) => {
      if (!d.isSat) {
        const c = FIRST_DATE_COL_INDEX + i
        requests.push(styleCells(sheetId, { startRowIndex: HEADER_ROW, endRowIndex: HEADER_ROW + 1, startColumnIndex: c, endColumnIndex: c + 1 }, { bg: SUN_HDR }))
      }
    })

    // Legend notes.
    requests.push(noteCell(sheetId, HEADER_ROW, PRESENT_COL_INDEX, 'Count of P (present) marks across all dates.'))
    requests.push(noteCell(sheetId, HEADER_ROW, OVERALL_COL_INDEX, '% of marked days present (S counts as absent). Green >=85%, yellow >=70%, red <70%.'))
    requests.push(noteCell(sheetId, HEADER_ROW, FIRST_DATE_COL_INDEX, 'Mark each session: P = Present, A = Absent, S = Sick/excused (counts as absent).'))

    // Conditional formats: mark colors (text) + Overall bands (numeric).
    const markRange = { startRowIndex: FIRST_DATA_ROW, endRowIndex: dataEnd, startColumnIndex: FIRST_DATE_COL_INDEX, endColumnIndex: totalCols }
    requests.push(textEqRule(sheetId, markRange, 'P', MARK_P))
    requests.push(textEqRule(sheetId, markRange, 'A', MARK_A))
    requests.push(textEqRule(sheetId, markRange, 'S', MARK_S))
    const overallRange = { startRowIndex: FIRST_DATA_ROW, endRowIndex: dataEnd, startColumnIndex: OVERALL_COL_INDEX, endColumnIndex: OVERALL_COL_INDEX + 1 }
    requests.push(numberCondRule(sheetId, overallRange, 'NUMBER_LESS', '0.7', RED))
    requests.push(numberCondRule(sheetId, overallRange, 'NUMBER_GREATER_THAN_EQ', '0.7', YELLOW))
    requests.push(numberCondRule(sheetId, overallRange, 'NUMBER_GREATER_THAN_EQ', '0.85', GREEN))

    // Zebra banding on student rows.
    if (rows > 0) {
      requests.push({
        addBanding: {
          bandedRange: {
            range: { sheetId, startRowIndex: FIRST_DATA_ROW, endRowIndex: dataEnd, startColumnIndex: 0, endColumnIndex: totalCols },
            rowProperties: { firstBandColor: WHITE, secondBandColor: ZEBRA },
          },
        },
      })
    }

    // Class-average row styling + top border.
    requests.push(styleCells(sheetId, { startRowIndex: dataEnd, endRowIndex: avgEnd, startColumnIndex: 0, endColumnIndex: totalCols }, { bg: AVG_BG, bold: true }))
    requests.push({ updateBorders: { range: { sheetId, startRowIndex: dataEnd, endRowIndex: avgEnd, startColumnIndex: 0, endColumnIndex: totalCols }, top: { style: 'SOLID_MEDIUM', color: HEADER_BG } } })

    // Protect header + Name + formula columns (incl. the average row).
    requests.push(lockRange(sheetId, { startRowIndex: 0, endRowIndex: HEADER_ROW + 1, startColumnIndex: 0, endColumnIndex: totalCols }, 'Header (locked)'))
    requests.push(lockRange(sheetId, { startRowIndex: FIRST_DATA_ROW, endRowIndex: avgEnd, startColumnIndex: NAME_COL_INDEX, endColumnIndex: NAME_COL_INDEX + 1 }, 'Name (locked)'))
    requests.push(lockRange(sheetId, { startRowIndex: FIRST_DATA_ROW, endRowIndex: avgEnd, startColumnIndex: PRESENT_COL_INDEX, endColumnIndex: PRESENT_COL_INDEX + 1 }, 'Present formula (locked)'))
    requests.push(lockRange(sheetId, { startRowIndex: FIRST_DATA_ROW, endRowIndex: avgEnd, startColumnIndex: OVERALL_COL_INDEX, endColumnIndex: OVERALL_COL_INDEX + 1 }, 'Overall formula (locked)'))
  }
  await sheetsApi('POST', `/${TARGET_SPREADSHEET_ID}:batchUpdate`, { requests })
}

/** Build / refresh the cross-class Summary tab. */
async function applySummary(plans: TabPlan[]) {
  let meta = await sheetsApi('GET', `/${TARGET_SPREADSHEET_ID}?fields=sheets.properties(sheetId,title),sheets.conditionalFormats,sheets.bandedRanges(bandedRangeId)`)
  let sheets = meta.sheets as SheetMeta[]
  let sm = sheets.find((s) => s.properties.title === SUMMARY_TAB)
  if (!sm) {
    await sheetsApi('POST', `/${TARGET_SPREADSHEET_ID}:batchUpdate`, { requests: [{ addSheet: { properties: { title: SUMMARY_TAB, index: 0 } } }] })
    meta = await sheetsApi('GET', `/${TARGET_SPREADSHEET_ID}?fields=sheets.properties(sheetId,title),sheets.conditionalFormats,sheets.bandedRanges(bandedRangeId)`)
    sheets = meta.sheets as SheetMeta[]
    sm = sheets.find((s) => s.properties.title === SUMMARY_TAB)!
  }
  const sheetId = sm.properties.sheetId

  await sheetsApi('POST', `/${TARGET_SPREADSHEET_ID}/values/${encodeURIComponent(`'${SUMMARY_TAB}'!A1:Z1000`)}:clear`, {})

  const headerRow = ['Class', 'Shift', 'Students', 'Avg Attendance']
  const classRows = plans.map((p) => {
    const last = FIRST_DATA_ROW + p.roster.length // 1-based last student row in that tab
    return [p.className, p.shift === Shift.MORNING ? 'AM' : 'PM', p.roster.length, `=IFERROR(AVERAGE('${p.title}'!F${FIRST_DATA_ROW + 1}:F${last}),"")`]
  })
  const firstClass = 3 // 1-based (row 1 title, row 2 header, row 3+ classes)
  const lastClass = firstClass + plans.length - 1
  const totalStudents = plans.reduce((n, p) => n + p.roster.length, 0)
  const totalRow = ['All classes', '', totalStudents, `=IFERROR(AVERAGE(D${firstClass}:D${lastClass}),"")`]
  await sheetsApi('POST', `/${TARGET_SPREADSHEET_ID}/values:batchUpdate`, {
    valueInputOption: 'USER_ENTERED',
    data: [{ range: `'${SUMMARY_TAB}'!A1`, values: [['Dugsi Attendance Summary'], headerRow, ...classRows, totalRow] }],
  })

  const avgCol = 3 // D
  const totalRowIdx = 2 + plans.length // 0-based index of totalRow
  const requests: object[] = [
    { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 2 } }, fields: 'gridProperties.frozenRowCount' } },
    colWidth(sheetId, 0, 1, 170),
    colWidth(sheetId, avgCol, avgCol + 1, 130),
    styleCells(sheetId, { startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 4 }, { bold: true }),
    styleCells(sheetId, { startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 4 }, { bg: HEADER_BG, bold: true, textColor: WHITE, hAlign: 'CENTER' }),
    styleCells(sheetId, { startRowIndex: totalRowIdx, endRowIndex: totalRowIdx + 1, startColumnIndex: 0, endColumnIndex: 4 }, { bg: AVG_BG, bold: true }),
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 2, endRowIndex: totalRowIdx + 1, startColumnIndex: avgCol, endColumnIndex: avgCol + 1 },
        cell: { userEnteredFormat: { numberFormat: { type: 'PERCENT', pattern: '0%' }, horizontalAlignment: 'CENTER' } },
        fields: 'userEnteredFormat.numberFormat,userEnteredFormat.horizontalAlignment',
      },
    },
  ]
  for (let i = (sm.conditionalFormats?.length ?? 0) - 1; i >= 0; i--) requests.push({ deleteConditionalFormatRule: { sheetId, index: i } })
  const avgRange = { startRowIndex: 2, endRowIndex: totalRowIdx, startColumnIndex: avgCol, endColumnIndex: avgCol + 1 }
  requests.push(numberCondRule(sheetId, avgRange, 'NUMBER_LESS', '0.7', RED))
  requests.push(numberCondRule(sheetId, avgRange, 'NUMBER_GREATER_THAN_EQ', '0.7', YELLOW))
  requests.push(numberCondRule(sheetId, avgRange, 'NUMBER_GREATER_THAN_EQ', '0.85', GREEN))
  await sheetsApi('POST', `/${TARGET_SPREADSHEET_ID}:batchUpdate`, { requests })
}

async function main() {
  console.log(APPLY ? '*** APPLY MODE — REPLACING WORKBOOK CONTENTS ***\n' : '--- DRY RUN (pass --apply to write) ---\n')

  const plans = await buildPlan()
  const days = weekendDays()
  const bands = monthBands(days)
  const lastDateCol = colLetter(FIRST_DATE_COL_INDEX + days.length - 1)

  let total = 0
  for (const p of plans) {
    total += p.roster.length
    console.log(`[${p.title}]  ${p.className}/${p.shift}  (${p.roster.length} students)`)
  }
  console.log(
    `\n${plans.length} class tabs + Summary, ${total} students. ${days.length} weekend cols (${days[0].label} … ${days[days.length - 1].label}, cols ${colLetter(FIRST_DATE_COL_INDEX)}:${lastDateCol}).` +
      `\nMonth bands: ${bands.map((b) => b.label).join(', ')}.` +
      `\nFrozen header+Name; P/A/S dropdown+color; Present + Overall% color-banded; zebra rows; class-average row; Name/header/formulas locked to ${OWNER_EMAIL}.`
  )

  if (!APPLY) {
    console.log('\nDry run complete. Re-run with --apply to write into the existing workbook.')
    return
  }

  const byTitle = await fetchMeta()
  for (const p of plans) if (!byTitle.has(p.title)) throw new Error(`tab "${p.title}" not found in target workbook`)

  await applyTabs(plans, days)
  await applySummary(plans)

  console.log(`\n✅ Replaced ${plans.length} class tabs + Summary. URL: https://docs.google.com/spreadsheets/d/${TARGET_SPREADSHEET_ID}/edit`)
}

runScript(main, { cleanup: () => prisma.$disconnect() })
