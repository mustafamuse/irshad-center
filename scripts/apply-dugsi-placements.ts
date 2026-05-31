import { Shift } from '@prisma/client'

import { prisma } from '@/lib/db'
import { runScript } from './lib/run-script'

/**
 * Apply reconciliation-confirmed Dugsi class placements.
 *
 * Source of decisions: scripts/data/dugsi-reconciliation-actions.md (2026-05-30).
 * DRY-RUN BY DEFAULT. Pass --apply to write. All writes run in one transaction.
 * Idempotent: re-running is a no-op. Fails loudly on ambiguous name resolution.
 *
 * Constraint note: DugsiClassEnrollment.programProfileId is @unique, so each
 * profile has at most one enrollment row. "place" upserts that row; "move"
 * updates its classId.
 */

interface Placement {
  name: string
  /** ISO date to disambiguate duplicate names (e.g. two "Khalid Ibrahim"). */
  dobHint?: string
  target: { name: string; shift: Shift }
  mode: 'place' | 'move'
  /** for mode 'move': the class the student is currently active in. */
  fromClass?: { name: string; shift: Shift }
}

const M = Shift.MORNING
const A = Shift.AFTERNOON

const PLACEMENTS: Placement[] = [
  // → 101/Morning (Mustafa Awil)
  { name: 'Hirsi Omar', target: { name: 'Mustafa Awil', shift: M }, mode: 'move', fromClass: { name: '[A.M] Khalid/Abdirahim', shift: M } },
  { name: 'Khalid Abdirahman', target: { name: 'Mustafa Awil', shift: M }, mode: 'place' },
  { name: 'Abdifatah Abdirahman', target: { name: 'Mustafa Awil', shift: M }, mode: 'place' },
  { name: 'Ibrahim Ibrahim', target: { name: 'Mustafa Awil', shift: M }, mode: 'place' },
  { name: 'Ahmed Ali', target: { name: 'Mustafa Awil', shift: M }, mode: 'place' },
  // → 105/Morning (Ducale Matan)
  { name: 'Adnah Ali', target: { name: 'Ducale Matan', shift: M }, mode: 'place' },
  { name: 'Rayan Abdi', target: { name: 'Ducale Matan', shift: M }, mode: 'place' },
  { name: 'Ikran Abdi', target: { name: 'Ducale Matan', shift: M }, mode: 'place' },
  { name: 'Zainab Hajijama', target: { name: 'Ducale Matan', shift: M }, mode: 'place' },
  { name: 'Sahraa Hajijama', target: { name: 'Ducale Matan', shift: M }, mode: 'place' },
  { name: 'Suheila Ali', target: { name: 'Ducale Matan', shift: M }, mode: 'place' },
  // → 103/Morning (Mohamed Ali-Daar)
  { name: 'Bashir Bashir', target: { name: 'Mohamed Ali-Daar', shift: M }, mode: 'place' },
  { name: 'Khalid Abdi', target: { name: 'Mohamed Ali-Daar', shift: M }, mode: 'place' },
  // paying-but-unplaced (not on any sheet); user: both in Mohamed's class
  { name: 'Ayan Ibrahim', dobHint: '2018-09-15', target: { name: 'Mohamed Ali-Daar', shift: M }, mode: 'place' },
  { name: 'Rayann Mohamed', dobHint: '2016-07-19', target: { name: 'Mohamed Ali-Daar', shift: M }, mode: 'place' },
  // → 104/Morning (Abdiwahab Haibah)
  { name: 'Bilan Abdirahman', target: { name: 'Abdiwahab Haibah', shift: M }, mode: 'place' },
  { name: 'Amiira Alim', target: { name: 'Abdiwahab Haibah', shift: M }, mode: 'place' },
  { name: 'Ismail Ibrahim', target: { name: 'Abdiwahab Haibah', shift: M }, mode: 'place' },
  { name: 'Khalid Ibrahim', dobHint: '2019-06-02', target: { name: 'Abdiwahab Haibah', shift: M }, mode: 'place' },
  // → 102/Afternoon (Suraya Mohamed)
  { name: 'Aisha Osman', target: { name: 'Suraya Mohamed', shift: A }, mode: 'place' },
  { name: 'Samia Aden', target: { name: 'Suraya Mohamed', shift: A }, mode: 'place' },
  { name: 'Farhiya Mohamed', target: { name: 'Suraya Mohamed', shift: A }, mode: 'place' },
  // correction: move 101/Morning → 101/Afternoon
  { name: 'Mohammad Mohammad', target: { name: 'Mustafa Awil', shift: A }, mode: 'move', fromClass: { name: 'Mustafa Awil', shift: M } },
  // correction: "Adil" on Mohamed tab = Adil Shimoye; move 104/Morning → 103/Morning
  { name: 'Adil Shimoye', dobHint: '2017-12-11', target: { name: 'Mohamed Ali-Daar', shift: M }, mode: 'move', fromClass: { name: 'Abdiwahab Haibah', shift: M } },
]

const APPLY = process.argv.includes('--apply')

interface Resolved {
  placement: Placement
  profileId: string
  currentClass: string | null
  targetClassId: string
  action: 'create' | 'reactivate' | 'move' | 'skip-already-there' | 'ERROR'
  note: string
}

async function classId(name: string, shift: Shift): Promise<string | null> {
  const c = await prisma.dugsiClass.findUnique({
    where: { name_shift: { name, shift } },
    select: { id: true },
  })
  return c?.id ?? null
}

async function resolve(p: Placement): Promise<Resolved> {
  const base = {
    placement: p,
    profileId: '',
    currentClass: null as string | null,
    targetClassId: '',
    action: 'ERROR' as Resolved['action'],
    note: '',
  }

  const tId = await classId(p.target.name, p.target.shift)
  if (!tId) return { ...base, note: `target class ${p.target.name}/${p.target.shift} not found` }
  base.targetClassId = tId

  const profiles = await prisma.programProfile.findMany({
    where: { program: 'DUGSI_PROGRAM', person: { name: p.name } },
    select: {
      id: true,
      person: { select: { dateOfBirth: true } },
      dugsiClassEnrollment: {
        select: { isActive: true, classId: true, class: { select: { name: true, shift: true } } },
      },
    },
  })

  const byName = p.dobHint
    ? profiles.filter(
        (x) => x.person.dateOfBirth?.toISOString().slice(0, 10) === p.dobHint
      )
    : profiles

  // Idempotency: already actively enrolled in the target class → no-op.
  const already = byName.find(
    (x) => x.dugsiClassEnrollment?.isActive && x.dugsiClassEnrollment.classId === tId
  )
  if (already) {
    return { ...base, profileId: already.id, currentClass: `${p.target.name}/${p.target.shift}`, action: 'skip-already-there', note: 'already enrolled in target' }
  }

  const candidates =
    p.mode === 'move'
      ? byName.filter(
          (x) =>
            x.dugsiClassEnrollment?.isActive &&
            x.dugsiClassEnrollment.class.name === p.fromClass!.name &&
            x.dugsiClassEnrollment.class.shift === p.fromClass!.shift
        )
      : byName.filter((x) => !x.dugsiClassEnrollment?.isActive)

  if (candidates.length !== 1) {
    return { ...base, note: `expected 1 ${p.mode} candidate, found ${candidates.length} (of ${profiles.length} by name)` }
  }

  const prof = candidates[0]
  base.profileId = prof.id
  const enr = prof.dugsiClassEnrollment
  base.currentClass = enr?.isActive ? `${enr.class.name}/${enr.class.shift}` : null

  if (p.mode === 'move') return { ...base, action: 'move', note: `from ${base.currentClass}` }
  if (!enr) return { ...base, action: 'create', note: 'no enrollment row' }
  return { ...base, action: 'reactivate', note: 'inactive enrollment row' }
}

async function main() {
  console.log(APPLY ? '*** APPLY MODE — WRITING ***\n' : '--- DRY RUN (pass --apply to write) ---\n')

  const resolved: Resolved[] = []
  for (const p of PLACEMENTS) resolved.push(await resolve(p))

  for (const r of resolved) {
    const tag = r.action === 'ERROR' ? '❌ ERROR' : r.action
    console.log(`[${tag}] ${r.placement.name} → ${r.placement.target.name}/${r.placement.target.shift}  ${r.note}`)
  }

  const errors = resolved.filter((r) => r.action === 'ERROR')
  if (errors.length) {
    throw new Error(`${errors.length} placement(s) failed to resolve — aborting (no writes).`)
  }

  const toWrite = resolved.filter((r) => r.action !== 'skip-already-there')
  console.log(`\nResolved ${resolved.length}; ${toWrite.length} need writes; ${resolved.length - toWrite.length} already correct.`)

  if (!APPLY) {
    console.log('\nDry run complete. Re-run with --apply to perform the writes.')
    return
  }

  await prisma.$transaction(
    toWrite.map((r) =>
      prisma.dugsiClassEnrollment.upsert({
        where: { programProfileId: r.profileId },
        update: { classId: r.targetClassId, isActive: true, endDate: null },
        create: { programProfileId: r.profileId, classId: r.targetClassId, isActive: true },
      })
    )
  )
  console.log(`\n✅ Applied ${toWrite.length} placement writes in one transaction.`)
}

runScript(main, { cleanup: () => prisma.$disconnect() })
