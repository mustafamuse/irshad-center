import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

import {
  ATTENDANCE_SHEET_ID,
  ROSTER_SNAPSHOT_PATH,
  STUDENT_NAME_RANGE,
  TAB_MAPPINGS,
  type AttendanceRosterSnapshot,
} from './config/dugsi-attendance-mapping'
import { runScript } from './lib/run-script'

/**
 * Reads column A of each mapped attendance tab via the Google Sheets REST API
 * and writes a local snapshot JSON. Strictly read-only against the sheet.
 *
 * Requires GOOGLE_ACCESS_TOKEN in the environment (mint with `python3 $GWS_AUTH`):
 *   GOOGLE_ACCESS_TOKEN=$(python3 $GWS_AUTH) \
 *     bunx tsx scripts/fetch-dugsi-attendance-roster.ts
 */

interface BatchGetResponse {
  valueRanges?: { range?: string; values?: string[][] }[]
}

async function main() {
  const token = process.env.GOOGLE_ACCESS_TOKEN
  if (!token) {
    throw new Error(
      'GOOGLE_ACCESS_TOKEN is required. Run: GOOGLE_ACCESS_TOKEN=$(python3 $GWS_AUTH) bunx tsx scripts/fetch-dugsi-attendance-roster.ts'
    )
  }

  const params = new URLSearchParams({ majorDimension: 'ROWS' })
  for (const { tab } of TAB_MAPPINGS) {
    params.append(
      'ranges',
      `'${tab.replace(/'/g, "''")}'!${STUDENT_NAME_RANGE}`
    )
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${ATTENDANCE_SHEET_ID}/values:batchGet?${params.toString()}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Sheets API ${res.status} ${res.statusText}: ${body}`)
  }

  const data = (await res.json()) as BatchGetResponse
  const valueRanges = data.valueRanges ?? []
  if (valueRanges.length !== TAB_MAPPINGS.length) {
    throw new Error(
      `Expected ${TAB_MAPPINGS.length} ranges, got ${valueRanges.length}`
    )
  }

  const snapshot: AttendanceRosterSnapshot = {
    sheetId: ATTENDANCE_SHEET_ID,
    fetchedAt: new Date().toISOString(),
    tabs: TAB_MAPPINGS.map(({ tab }, i) => {
      const rows = valueRanges[i]?.values ?? []
      const students = rows
        .map((row) => (row[0] ?? '').trim())
        .filter((name) => name.length > 0)
      return { tab, students }
    }),
  }

  await mkdir(dirname(ROSTER_SNAPSHOT_PATH), { recursive: true })
  await writeFile(ROSTER_SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2))

  console.log(`Wrote ${ROSTER_SNAPSHOT_PATH}`)
  const rangeCeiling = Number(STUDENT_NAME_RANGE.match(/\d+$/)?.[0] ?? 0) - 1 // header row excluded
  for (const { tab, students } of snapshot.tabs) {
    console.log(`  ${tab}: ${students.length} students`)
    if (rangeCeiling > 0 && students.length >= rangeCeiling) {
      console.warn(
        `  ⚠ WARNING: "${tab}" returned ${students.length} names, filling STUDENT_NAME_RANGE (${STUDENT_NAME_RANGE}). The tab may be truncated — raise the range.`
      )
    }
  }
}

runScript(main)
