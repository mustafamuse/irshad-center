import { Gender, Program, Shift, GuardianRole, EnrollmentStatus } from '@prisma/client'
import { z } from 'zod'

import { prisma } from '@/lib/db'
import { runScript } from './lib/run-script'

/**
 * Register confirmed-new Dugsi students who attend on the attendance sheet but
 * have no DB record yet.
 *
 * Source of decisions: scripts/data/dugsi-reconciliation-actions.md §6 (2026-05-30).
 * Confirmed by user: register Ehsan Ismail, Abdirahim Ismail, Abdullahi Ismail
 * (three children of teacher Mohamed Hassan), and Umeyr Somane (5th Somane sibling).
 * The three 101-Afternoon names (Muneer/Malik Ismail, Anas) were dropped — "dont
 * attend here at all". Abdullahi's real name is "Abdullahi Ismail" (Mustafa
 * 101/Morning tab); he also appears as "Abdullahi Sh Nuur" on the Islamic Studies
 * tab — same boy.
 *
 * DRY-RUN BY DEFAULT. Pass --apply to write. Each student is created in one
 * interactive $transaction (Person -> ProgramProfile -> DugsiClassEnrollment ->
 * optional GuardianRelationship) so a failure never leaves a half-written family.
 *
 * BLOCKER: dateOfBirth is a placeholder (null) for every entry below. The sheet
 * has no DOB and neither does the DB. Fill each `dob` with a real 'YYYY-MM-DD'
 * before running --apply; the script fails loudly (no writes) while any is null.
 *
 * Idempotent: a student already present as a DUGSI ProgramProfile matching
 * (name, dateOfBirth) is skipped, so re-running is a no-op.
 */

const M = Shift.MORNING

// Existing Somane family (Ubeyd/Amaad/Emran/Aamir share this ref). Reused so
// Umeyr attaches to his siblings rather than starting a new family group.
const SOMANE_FAMILY_REF = '644ba1fc-2a52-4808-af59-0e87d674a785'
// New shared family ref for the three Ismail/Hassan children (no prior DB row).
const ISMAIL_FAMILY_REF = 'c4e8a1b2-3d6f-4a90-b8e1-2f7c9d0a5e34'
// New shared family ref for the Yussuf children (no prior DB family row).
const YUSSUF_FAMILY_REF = 'b7e3f1a4-2c5d-4e89-9a16-3f8d0c7b2e54'
// Person id of teacher Mohamed Hassan — father/guardian of the Ismail juniors.
const MOHAMED_HASSAN_PERSON_ID = '22c56cb1-c2c2-4eb2-bdcd-de8fbea448c4'

const RegistrationSchema = z.object({
  name: z.string().min(1),
  /** 'YYYY-MM-DD'; null = placeholder, must be filled before --apply. */
  dob: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'dob must be YYYY-MM-DD')
    .nullable(),
  gender: z.nativeEnum(Gender),
  shift: z.nativeEnum(Shift),
  /** Target Dugsi class (name, shift) the sheet places them in. */
  target: z.object({ name: z.string().min(1), shift: z.nativeEnum(Shift) }),
  familyReferenceId: z.string().uuid(),
  /** When set, link the new student as PARENT-dependent of this guardian Person. */
  guardianPersonId: z.string().uuid().optional(),
})

type Registration = z.infer<typeof RegistrationSchema>

const REGISTRATIONS: Registration[] = [
  {
    name: 'Ehsan Ismail',
    dob: '2013-11-18',
    gender: Gender.MALE,
    shift: M,
    target: { name: 'Ducale Matan', shift: M },
    familyReferenceId: ISMAIL_FAMILY_REF,
    guardianPersonId: MOHAMED_HASSAN_PERSON_ID,
  },
  {
    name: 'Abdirahim Ismail',
    dob: '2016-10-09',
    gender: Gender.MALE,
    shift: M,
    target: { name: 'Mohamed Ali-Daar', shift: M },
    familyReferenceId: ISMAIL_FAMILY_REF,
    guardianPersonId: MOHAMED_HASSAN_PERSON_ID,
  },
  {
    // 3rd Hassan child; "Abdullahi Sh Nuur" on the Islamic Studies tab = same boy.
    name: 'Abdullahi Ismail',
    dob: '2011-03-10',
    gender: Gender.MALE,
    shift: M,
    target: { name: 'Mustafa Awil', shift: M },
    familyReferenceId: ISMAIL_FAMILY_REF,
    guardianPersonId: MOHAMED_HASSAN_PERSON_ID,
  },
  {
    name: 'Umeyr Somane',
    dob: null, // TODO: fill 'YYYY-MM-DD' before --apply
    gender: Gender.MALE,
    shift: M,
    target: { name: 'Abdiwahab Haibah', shift: M },
    familyReferenceId: SOMANE_FAMILY_REF,
    // No guardian: existing Somane siblings carry no guardian link in the DB.
  },
  {
    // Spelling unconfirmed: "Amira" on the 105/Morning (Ducale) tab, "Ameera" on
    // the Islamic Studies tab — same girl. Confirm spelling at registration.
    name: 'Amira Yussuf',
    dob: null, // TODO: fill 'YYYY-MM-DD' before --apply
    gender: Gender.FEMALE,
    shift: M,
    target: { name: 'Ducale Matan', shift: M },
    familyReferenceId: YUSSUF_FAMILY_REF,
    // No guardian on file yet.
  },
  {
    // Amira's sibling; only on the Islamic Studies tab — user confirmed 101/Morning.
    name: 'Ammaar Yussuf',
    dob: null, // TODO: fill 'YYYY-MM-DD' before --apply
    gender: Gender.MALE,
    shift: M,
    target: { name: 'Mustafa Awil', shift: M },
    familyReferenceId: YUSSUF_FAMILY_REF,
    // No guardian on file yet.
  },
]

const APPLY = process.argv.includes('--apply')

interface Resolved {
  reg: Registration
  targetClassId: string
  action: 'create' | 'skip-already-there' | 'ERROR'
  note: string
}

async function classId(name: string, shift: Shift): Promise<string | null> {
  const c = await prisma.dugsiClass.findUnique({
    where: { name_shift: { name, shift } },
    select: { id: true },
  })
  return c?.id ?? null
}

async function resolve(reg: Registration): Promise<Resolved> {
  const base = { reg, targetClassId: '', action: 'ERROR' as Resolved['action'], note: '' }

  const tId = await classId(reg.target.name, reg.target.shift)
  if (!tId) return { ...base, note: `target class ${reg.target.name}/${reg.target.shift} not found` }
  base.targetClassId = tId

  if (reg.guardianPersonId) {
    const guardian = await prisma.person.findUnique({
      where: { id: reg.guardianPersonId },
      select: { id: true },
    })
    if (!guardian) return { ...base, note: `guardian person ${reg.guardianPersonId} not found` }
  }

  // Idempotency: an existing DUGSI profile matching (name, dob) means already
  // registered. Requires dob to be filled; the apply gate enforces that.
  if (reg.dob) {
    const existing = await prisma.programProfile.findFirst({
      where: {
        program: Program.DUGSI_PROGRAM,
        person: { name: reg.name, dateOfBirth: new Date(`${reg.dob}T00:00:00.000Z`) },
      },
      select: { id: true },
    })
    if (existing) return { ...base, action: 'skip-already-there', note: 'already registered' }
  }

  return { ...base, action: 'create', note: reg.guardianPersonId ? 'create + guardian link' : 'create' }
}

async function main() {
  console.log(APPLY ? '*** APPLY MODE — WRITING ***\n' : '--- DRY RUN (pass --apply to write) ---\n')

  // Validate the static config up front (fail loud on a malformed entry).
  for (const reg of REGISTRATIONS) RegistrationSchema.parse(reg)

  const resolved: Resolved[] = []
  for (const reg of REGISTRATIONS) resolved.push(await resolve(reg))

  for (const r of resolved) {
    const tag = r.action === 'ERROR' ? '❌ ERROR' : r.action
    const dobTag = r.reg.dob ?? 'DOB MISSING'
    console.log(`[${tag}] ${r.reg.name} (${dobTag}) → ${r.reg.target.name}/${r.reg.target.shift}  ${r.note}`)
  }

  const errors = resolved.filter((r) => r.action === 'ERROR')
  if (errors.length) {
    throw new Error(`${errors.length} registration(s) failed to resolve — aborting (no writes).`)
  }

  const toCreate = resolved.filter((r) => r.action === 'create')
  const missingDob = toCreate.filter((r) => !r.reg.dob).map((r) => r.reg.name)

  console.log(
    `\nResolved ${resolved.length}; ${toCreate.length} to create; ${resolved.length - toCreate.length} already registered.`
  )

  if (!APPLY) {
    if (missingDob.length) {
      console.log(`\nDOB still needed for: ${missingDob.join(', ')}. Fill each entry's dob before --apply.`)
    }
    console.log('\nDry run complete. Re-run with --apply to perform the writes.')
    return
  }

  if (missingDob.length) {
    throw new Error(`Cannot apply: DOB missing for ${missingDob.join(', ')}. Fill each dob then re-run.`)
  }

  await prisma.$transaction(async (tx) => {
    for (const r of toCreate) {
      const { reg } = r
      const person = await tx.person.create({
        data: { name: reg.name, dateOfBirth: new Date(`${reg.dob}T00:00:00.000Z`) },
        select: { id: true },
      })
      const profile = await tx.programProfile.create({
        data: {
          personId: person.id,
          program: Program.DUGSI_PROGRAM,
          status: EnrollmentStatus.REGISTERED,
          monthlyRate: 0,
          gender: reg.gender,
          shift: reg.shift,
          familyReferenceId: reg.familyReferenceId,
        },
        select: { id: true },
      })
      await tx.dugsiClassEnrollment.create({
        data: { programProfileId: profile.id, classId: r.targetClassId, isActive: true },
      })
      if (reg.guardianPersonId) {
        await tx.guardianRelationship.create({
          data: {
            guardianId: reg.guardianPersonId,
            dependentId: person.id,
            role: GuardianRole.PARENT,
          },
        })
      }
    }
  })

  console.log(`\n✅ Registered ${toCreate.length} student(s) in one transaction.`)
}

runScript(main, { cleanup: () => prisma.$disconnect() })
