/**
 * Dugsi Enrollment Filter Audit (read-only)
 *
 * Compares four candidate "is enrolled in Dugsi" filter rules against the
 * live DB and reports the count + delta for each. Lets us pick a canonical
 * rule with real numbers instead of theory.
 *
 * Rules compared:
 *   A: ProgramProfile.status != WITHDRAWN
 *   B: Has Enrollment row with status != WITHDRAWN AND endDate IS NULL
 *   C: A AND active Stripe Subscription via BillingAssignment
 *   D: A AND family (familyReferenceId) has >=1 A-matching kid
 *
 * Usage:
 *   set -a && source .env.local && set +a && bunx tsx scripts/audit-dugsi-enrollment-filter.ts
 */

import { EnrollmentStatus, Program, SubscriptionStatus } from '@prisma/client'

import { prisma } from '@/lib/db'

import { runScript } from './lib/run-script'

async function main() {
  const totalDugsiProfiles = await prisma.programProfile.count({
    where: { program: Program.DUGSI_PROGRAM },
  })

  const ruleA = await prisma.programProfile.count({
    where: {
      program: Program.DUGSI_PROGRAM,
      status: { not: EnrollmentStatus.WITHDRAWN },
    },
  })

  const ruleB = await prisma.programProfile.count({
    where: {
      program: Program.DUGSI_PROGRAM,
      enrollments: {
        some: { status: { not: EnrollmentStatus.WITHDRAWN }, endDate: null },
      },
    },
  })

  const ruleC = await prisma.programProfile.count({
    where: {
      program: Program.DUGSI_PROGRAM,
      status: { not: EnrollmentStatus.WITHDRAWN },
      assignments: {
        some: {
          isActive: true,
          subscription: { status: SubscriptionStatus.active },
        },
      },
    },
  })

  // Rule D: profile is non-WITHDRAWN AND has at least one OTHER non-WITHDRAWN
  // sibling in the same family. Build family IDs from profiles that have
  // siblings (count >= 2 in the family group) to avoid counting a profile as
  // its own active sibling.
  const familyCounts = await prisma.programProfile.groupBy({
    by: ['familyReferenceId'],
    where: {
      program: Program.DUGSI_PROGRAM,
      status: { not: EnrollmentStatus.WITHDRAWN },
      familyReferenceId: { not: null },
    },
    _count: { id: true },
  })
  const familiesWithSiblings = new Set(
    familyCounts
      .filter((g) => g._count.id >= 2)
      .map((g) => g.familyReferenceId as string)
  )
  const ruleD = await prisma.programProfile.count({
    where: {
      program: Program.DUGSI_PROGRAM,
      status: { not: EnrollmentStatus.WITHDRAWN },
      familyReferenceId: { in: Array.from(familiesWithSiblings) },
    },
  })

  // Cross-cutting diagnostics
  const profileWithdrawn = await prisma.programProfile.count({
    where: {
      program: Program.DUGSI_PROGRAM,
      status: EnrollmentStatus.WITHDRAWN,
    },
  })
  const enrollmentWithdrawn = await prisma.enrollment.count({
    where: {
      programProfile: { program: Program.DUGSI_PROGRAM },
      status: EnrollmentStatus.WITHDRAWN,
    },
  })

  // Drift: profile NOT WITHDRAWN but only-withdrawn enrollment row(s)
  const driftProfileActiveEnrollmentDead = await prisma.programProfile.count({
    where: {
      program: Program.DUGSI_PROGRAM,
      status: { not: EnrollmentStatus.WITHDRAWN },
      enrollments: {
        none: { status: { not: EnrollmentStatus.WITHDRAWN }, endDate: null },
      },
    },
  })

  // Drift: profile WITHDRAWN but class enrollment still isActive (ghost roster)
  const ghostClassEnrollments = await prisma.dugsiClassEnrollment.count({
    where: {
      isActive: true,
      programProfile: { status: EnrollmentStatus.WITHDRAWN },
    },
  })

  // Drift: profile WITHDRAWN but Stripe sub still active
  const withdrawnButPaying = await prisma.programProfile.count({
    where: {
      program: Program.DUGSI_PROGRAM,
      status: EnrollmentStatus.WITHDRAWN,
      assignments: {
        some: {
          isActive: true,
          subscription: { status: SubscriptionStatus.active },
        },
      },
    },
  })

  const rows = [
    {
      rule: 'Total Dugsi profiles',
      count: totalDugsiProfiles,
      pct: '100.0%',
    },
    {
      rule: 'A: status != WITHDRAWN',
      count: ruleA,
      pct: pct(ruleA, totalDugsiProfiles),
    },
    {
      rule: 'B: active Enrollment row',
      count: ruleB,
      pct: pct(ruleB, totalDugsiProfiles),
    },
    {
      rule: 'C: A AND active Stripe sub',
      count: ruleC,
      pct: pct(ruleC, totalDugsiProfiles),
    },
    {
      rule: 'D: A AND family has >=1 active',
      count: ruleD,
      pct: pct(ruleD, totalDugsiProfiles),
    },
  ]

  console.log('\n=== DUGSI ENROLLMENT FILTER COMPARISON ===\n')
  console.table(rows)

  console.log(
    '\n=== DELTAS (each rule vs the prior, kids that would disappear) ==='
  )
  console.log(
    `A - B (status-only includes but enrollment-row excludes): ${ruleA - ruleB}`
  )
  console.log(
    `A - C (status-only includes but no active sub):           ${ruleA - ruleC}`
  )
  console.log(
    `A - D (status-only includes but no sibling enrolled):     ${ruleA - ruleD}`
  )

  console.log('\n=== CROSS-CUTTING DIAGNOSTICS ===')
  console.log(
    `Profile rows marked WITHDRAWN:               ${profileWithdrawn}`
  )
  console.log(
    `Enrollment rows marked WITHDRAWN:            ${enrollmentWithdrawn}`
  )
  console.log(
    `Drift A: profile active but enrollment dead: ${driftProfileActiveEnrollmentDead}`
  )
  console.log(
    `Drift B: profile WITHDRAWN but class active: ${ghostClassEnrollments}`
  )
  console.log(
    `Drift C: profile WITHDRAWN but paying:       ${withdrawnButPaying}`
  )
}

function pct(n: number, total: number): string {
  if (total === 0) return '0.0%'
  return `${((n / total) * 100).toFixed(1)}%`
}

runScript(main, { cleanup: () => prisma.$disconnect() })
