/**
 * Backfill: deactivate ghost Dugsi class enrollments (dry-run by default)
 *
 * Before the Stripe cancellation cascade deactivated DugsiClassEnrollment rows,
 * a child withdrawn via customer.subscription.deleted kept an active class row
 * — staying on the roster and in the headcount forever. The fixed cascade skips
 * profiles that are already WITHDRAWN, so it will never heal those rows on its
 * own. This script closes them once.
 *
 * Matches the "Drift B: profile WITHDRAWN but class active" diagnostic in
 * scripts/audit-dugsi-enrollment-filter.ts.
 *
 * Usage:
 *   set -a && source .env.local && set +a && bunx tsx scripts/backfill-ghost-class-enrollments.ts
 *   ... same, with --apply to write
 */

import { EnrollmentStatus, Program } from '@prisma/client'

import { prisma } from '@/lib/db'

import { runScript } from './lib/run-script'

const GHOST_FILTER = {
  isActive: true,
  programProfile: {
    program: Program.DUGSI_PROGRAM,
    status: EnrollmentStatus.WITHDRAWN,
  },
} as const

async function main() {
  const apply = process.argv.includes('--apply')

  const ghosts = await prisma.dugsiClassEnrollment.findMany({
    where: GHOST_FILTER,
    select: {
      id: true,
      startDate: true,
      class: { select: { name: true } },
      programProfile: {
        select: { id: true, person: { select: { name: true } } },
      },
    },
    orderBy: { startDate: 'asc' },
  })

  if (ghosts.length === 0) {
    console.log('No ghost class enrollments found. Nothing to do.')
    return
  }

  console.log(`\nFound ${ghosts.length} ghost class enrollment(s):\n`)
  console.table(
    ghosts.map((row) => ({
      student: row.programProfile.person.name,
      class: row.class.name,
      since: row.startDate.toISOString().slice(0, 10),
      profileId: row.programProfile.id,
    }))
  )

  if (!apply) {
    console.log('\nDRY RUN — re-run with --apply to deactivate these rows.')
    return
  }

  const result = await prisma.dugsiClassEnrollment.updateMany({
    where: GHOST_FILTER,
    data: { isActive: false, endDate: new Date() },
  })

  console.log(`\nDeactivated ${result.count} class enrollment(s).`)
}

runScript(main, { cleanup: () => prisma.$disconnect() })
