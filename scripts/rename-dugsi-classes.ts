import { Shift } from '@prisma/client'

import { prisma } from '@/lib/db'
import { runScript } from './lib/run-script'

/**
 * Rename Dugsi classes from numeric codes to their teacher's name.
 *
 * Confirmed with the program owner (2026-05-30). The DB unique key is
 * (name, shift), so two classes may share a teacher name as long as their
 * shifts differ (Mustafa Awil AM/PM; Mohamed Ali-Daar AM/PM).
 *
 * DRY-RUN BY DEFAULT. Pass --apply to write. All renames run in one transaction.
 * Idempotent: a class already at its target name is skipped, so re-running is a
 * no-op. Fails loudly if a source class is missing or a target (name, shift)
 * would collide with a different existing class.
 *
 * Staffing note: 103/Afternoon and 104/Morning were taught by Abdirahim Haibah,
 * who is no longer teaching — 103/PM is now Mohamed Ali-Daar, 104/AM is Abdiwahab
 * Haibah. The inactive empty classes are intentionally left untouched.
 */

const M = Shift.MORNING
const A = Shift.AFTERNOON

interface Rename {
  from: { name: string; shift: Shift }
  to: string
}

const RENAMES: Rename[] = [
  { from: { name: '101', shift: M }, to: 'Mustafa Awil' },
  { from: { name: '101', shift: A }, to: 'Mustafa Awil' },
  { from: { name: '102', shift: A }, to: 'Suraya Mohamed' },
  { from: { name: '103', shift: M }, to: 'Mohamed Ali-Daar' },
  { from: { name: '103', shift: A }, to: 'Mohamed Ali-Daar' },
  { from: { name: '104', shift: M }, to: 'Abdiwahab Haibah' },
  { from: { name: '105', shift: M }, to: 'Ducale Matan' },
  { from: { name: 'Pre Mahad', shift: M }, to: 'Hamza Hassan' },
]

const APPLY = process.argv.includes('--apply')

interface Resolved {
  rename: Rename
  classId: string | null
  action: 'rename' | 'skip-already-named' | 'ERROR'
  note: string
}

async function findClass(name: string, shift: Shift) {
  return prisma.dugsiClass.findUnique({
    where: { name_shift: { name, shift } },
    select: { id: true },
  })
}

async function resolve(r: Rename): Promise<Resolved> {
  const base = { rename: r, classId: null as string | null, action: 'ERROR' as Resolved['action'], note: '' }

  const source = await findClass(r.from.name, r.from.shift)
  if (source) {
    // A different class already at the target (name, shift) would collide.
    const collision = await findClass(r.to, r.from.shift)
    if (collision && collision.id !== source.id) {
      return { ...base, note: `target ${r.to}/${r.from.shift} already exists on another class` }
    }
    return { ...base, classId: source.id, action: 'rename', note: `${r.from.name} → ${r.to}` }
  }

  // Source missing → maybe already renamed (idempotency).
  const target = await findClass(r.to, r.from.shift)
  if (target) {
    return { ...base, classId: target.id, action: 'skip-already-named', note: `already ${r.to}/${r.from.shift}` }
  }
  return { ...base, note: `source class ${r.from.name}/${r.from.shift} not found` }
}

async function main() {
  console.log(APPLY ? '*** APPLY MODE — WRITING ***\n' : '--- DRY RUN (pass --apply to write) ---\n')

  const resolved: Resolved[] = []
  for (const r of RENAMES) resolved.push(await resolve(r))

  for (const r of resolved) {
    const tag = r.action === 'ERROR' ? '❌ ERROR' : r.action
    console.log(`[${tag}] ${r.rename.from.name}/${r.rename.from.shift} → ${r.rename.to}  ${r.note}`)
  }

  const errors = resolved.filter((r) => r.action === 'ERROR')
  if (errors.length) {
    throw new Error(`${errors.length} rename(s) failed to resolve — aborting (no writes).`)
  }

  const toWrite = resolved.filter((r) => r.action === 'rename')
  console.log(`\nResolved ${resolved.length}; ${toWrite.length} to rename; ${resolved.length - toWrite.length} already named.`)

  if (!APPLY) {
    console.log('\nDry run complete. Re-run with --apply to perform the renames.')
    return
  }

  await prisma.$transaction(
    toWrite.map((r) =>
      prisma.dugsiClass.update({
        where: { id: r.classId! },
        data: { name: r.rename.to },
      })
    )
  )
  console.log(`\n✅ Renamed ${toWrite.length} classes in one transaction.`)
}

runScript(main, { cleanup: () => prisma.$disconnect() })
