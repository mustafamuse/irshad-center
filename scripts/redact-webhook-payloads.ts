/**
 * Redact stored webhook payloads past their useful life (dry-run by default)
 *
 * WebhookEvent.payload holds the full raw Stripe event, which for invoice and
 * customer events includes customer_email, customer_name, customer_address and
 * customer_phone. Rows accumulate indefinitely, so that PII sits at rest for as
 * long as the table lives.
 *
 * This nulls the payload column only. The row, its (eventId, source) unique key
 * and processedAt all survive, so WebhookEvent stays append-only and rule-12
 * idempotency is unaffected — a redelivery of an old event still matches its
 * existing row and is still skipped.
 *
 * Retention must stay comfortably above Stripe's retry window (3 days), since a
 * payload is only useful for debugging a delivery that might still be retried.
 *
 * Usage:
 *   set -a && source .env.local && set +a && bunx tsx scripts/redact-webhook-payloads.ts
 *   ... add --apply to write, --days=<n> to override the 30-day default
 */

import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/db'

import { runScript } from './lib/run-script'

const DEFAULT_RETENTION_DAYS = 30
const MIN_RETENTION_DAYS = 7

function parseDays(): number {
  const arg = process.argv.find((a) => a.startsWith('--days='))
  if (!arg) return DEFAULT_RETENTION_DAYS

  const value = Number(arg.slice('--days='.length))
  if (!Number.isInteger(value) || value < MIN_RETENTION_DAYS) {
    throw new Error(
      `--days must be an integer >= ${MIN_RETENTION_DAYS} (Stripe retries for 3 days; keep a margin)`
    )
  }
  return value
}

async function main() {
  const apply = process.argv.includes('--apply')
  const days = parseDays()

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)

  // `not: Prisma.DbNull` targets SQL NULL specifically; a JSON `null` value
  // would be a legitimately stored payload, not an already-redacted row.
  const filter = {
    processedAt: { lt: cutoff },
    payload: { not: Prisma.DbNull },
  }

  const [totalRows, withPayload, toRedact] = await Promise.all([
    prisma.webhookEvent.count(),
    prisma.webhookEvent.count({ where: { payload: { not: Prisma.DbNull } } }),
    prisma.webhookEvent.count({ where: filter }),
  ])

  const oldest = await prisma.webhookEvent.findFirst({
    select: { processedAt: true },
    orderBy: { processedAt: 'asc' },
  })

  console.log(`\nRetention: ${days} days (cutoff ${cutoff.toISOString()})`)
  console.log(`  total rows              : ${totalRows}`)
  console.log(`  rows holding a payload  : ${withPayload}`)
  console.log(`  older than cutoff       : ${toRedact}`)
  console.log(
    `  oldest row              : ${oldest?.processedAt.toISOString() ?? 'n/a'}`
  )

  if (toRedact === 0) {
    console.log('\nNothing to redact.')
    return
  }

  if (!apply) {
    console.log('\nDRY RUN — re-run with --apply to null these payloads.')
    return
  }

  const result = await prisma.webhookEvent.updateMany({
    where: filter,
    data: { payload: Prisma.DbNull },
  })

  console.log(`\nRedacted ${result.count} payload(s). Rows and event IDs kept.`)
}

runScript(main, { cleanup: () => prisma.$disconnect() })
