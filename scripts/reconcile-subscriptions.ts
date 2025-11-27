/**
 * Subscription Reconciliation Script
 *
 * Links existing Stripe subscriptions to re-registered students.
 *
 * Usage:
 *   npx tsx scripts/reconcile-subscriptions.ts --dugsi-only # Dugsi only
 *
 * Output:
 *   - Console: Progress and summary
 *   - CSV: ./reconciliation-unmatched-{timestamp}.csv
 */

import * as fs from 'fs'

import {
  getAllOrphanedSubscriptions,
  getPotentialStudentMatches,
  linkSubscriptionToProfile,
  type OrphanedSubscription,
  type StudentMatch,
} from '@/lib/services/link-subscriptions/subscription-linking-service'

// Parse command line arguments
const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const MAHAD_ONLY = args.includes('--mahad-only')
const DUGSI_ONLY = args.includes('--dugsi-only')

interface ReconciliationResult {
  subscription: OrphanedSubscription
  status: 'linked' | 'unmatched' | 'skipped' | 'error'
  match?: StudentMatch
  reason?: string
}

/**
 * Format currency amount from cents to dollars
 */
function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

/**
 * Export unmatched subscriptions to CSV
 */
function exportToCSV(results: ReconciliationResult[]): string {
  const unmatched = results.filter(
    (r) => r.status === 'unmatched' || r.status === 'error'
  )

  if (unmatched.length === 0) {
    return ''
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = `reconciliation-unmatched-${timestamp}.csv`

  const headers = [
    'stripe_subscription_id',
    'stripe_customer_id',
    'customer_email',
    'customer_name',
    'amount',
    'program',
    'status',
    'reason',
  ]

  const rows = unmatched.map((r) => [
    r.subscription.id,
    r.subscription.customerId,
    r.subscription.customerEmail || '',
    r.subscription.customerName || '',
    formatCurrency(r.subscription.amount),
    r.subscription.program,
    r.status,
    r.reason || '',
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n')

  fs.writeFileSync(filename, csvContent)
  return filename
}

/**
 * Process a single subscription and attempt to link it
 */
async function processSubscription(
  subscription: OrphanedSubscription
): Promise<ReconciliationResult> {
  // Skip if no email
  if (!subscription.customerEmail) {
    return {
      subscription,
      status: 'unmatched',
      reason: 'no_email',
    }
  }

  // Find potential matches
  const matches = await getPotentialStudentMatches(
    subscription.customerEmail,
    subscription.program
  )

  // Filter to students without existing subscription
  const availableMatches = matches.filter((m) => !m.hasSubscription)

  if (availableMatches.length === 0) {
    // Check if there were matches but all already have subscriptions
    if (matches.length > 0) {
      return {
        subscription,
        status: 'unmatched',
        reason: 'all_matches_have_subscriptions',
      }
    }
    return {
      subscription,
      status: 'unmatched',
      reason: 'no_person_match',
    }
  }

  if (availableMatches.length > 1) {
    return {
      subscription,
      status: 'unmatched',
      reason: `multiple_matches (${availableMatches.length})`,
    }
  }

  // Single match found
  const match = availableMatches[0]

  // If dry run, don't actually link
  if (DRY_RUN) {
    return {
      subscription,
      status: 'linked',
      match,
      reason: 'dry_run',
    }
  }

  // Link the subscription
  try {
    const result = await linkSubscriptionToProfile(
      subscription.id,
      match.id,
      subscription.program
    )

    if (result.success) {
      return {
        subscription,
        status: 'linked',
        match,
      }
    } else {
      return {
        subscription,
        status: 'error',
        match,
        reason: result.error,
      }
    }
  } catch (error) {
    return {
      subscription,
      status: 'error',
      match,
      reason: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Main reconciliation function
 */
async function main() {
  console.log('\n' + '='.repeat(60))
  console.log(
    `STRIPE SUBSCRIPTION RECONCILIATION ${DRY_RUN ? '(DRY RUN)' : ''}`
  )
  console.log('='.repeat(60))

  if (MAHAD_ONLY) console.log('Mode: Mahad only')
  else if (DUGSI_ONLY) console.log('Mode: Dugsi only')
  else console.log('Mode: Both Mahad and Dugsi')

  console.log('')

  // Fetch all orphaned subscriptions
  console.log('Fetching orphaned subscriptions from Stripe...')
  let orphanedSubscriptions = await getAllOrphanedSubscriptions()

  // Filter by program if specified
  if (MAHAD_ONLY) {
    orphanedSubscriptions = orphanedSubscriptions.filter(
      (s) => s.program === 'MAHAD'
    )
  } else if (DUGSI_ONLY) {
    orphanedSubscriptions = orphanedSubscriptions.filter(
      (s) => s.program === 'DUGSI'
    )
  }

  console.log(`Found ${orphanedSubscriptions.length} orphaned subscriptions\n`)

  if (orphanedSubscriptions.length === 0) {
    console.log('No orphaned subscriptions to process. Exiting.')
    return
  }

  // Process each subscription
  const results: ReconciliationResult[] = []
  const stats = {
    linked: 0,
    unmatched: 0,
    skipped: 0,
    error: 0,
  }

  for (let i = 0; i < orphanedSubscriptions.length; i++) {
    const subscription = orphanedSubscriptions[i]
    const progress = `[${i + 1}/${orphanedSubscriptions.length}]`

    process.stdout.write(
      `${progress} Processing ${subscription.customerEmail || 'no-email'} (${subscription.program})... `
    )

    const result = await processSubscription(subscription)
    results.push(result)
    stats[result.status]++

    if (result.status === 'linked') {
      console.log(`✅ Linked to ${result.match?.name}`)
    } else if (result.status === 'unmatched') {
      console.log(`⚠️  Unmatched: ${result.reason}`)
    } else if (result.status === 'error') {
      console.log(`❌ Error: ${result.reason}`)
    } else {
      console.log(`⏭️  Skipped`)
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(60))
  console.log('SUMMARY')
  console.log('='.repeat(60))
  console.log(`Total processed:  ${orphanedSubscriptions.length}`)
  console.log(`Linked:           ${stats.linked}`)
  console.log(`Unmatched:        ${stats.unmatched}`)
  console.log(`Errors:           ${stats.error}`)

  // Export unmatched to CSV
  const csvFile = exportToCSV(results)
  if (csvFile) {
    console.log(`\nUnmatched exported to: ${csvFile}`)
  }

  // Print unmatched details
  const unmatched = results.filter((r) => r.status === 'unmatched')
  if (unmatched.length > 0) {
    console.log('\n' + '='.repeat(60))
    console.log('UNMATCHED SUBSCRIPTIONS')
    console.log('='.repeat(60))
    for (const r of unmatched) {
      console.log(
        `  ${r.subscription.program} | ${r.subscription.customerEmail || 'no-email'} | ${formatCurrency(r.subscription.amount)} | ${r.reason}`
      )
    }
  }

  // Print errors
  const errors = results.filter((r) => r.status === 'error')
  if (errors.length > 0) {
    console.log('\n' + '='.repeat(60))
    console.log('ERRORS')
    console.log('='.repeat(60))
    for (const r of errors) {
      console.log(`  ${r.subscription.id} | ${r.reason}`)
    }
  }

  if (DRY_RUN) {
    console.log('\n' + '='.repeat(60))
    console.log('DRY RUN COMPLETE - No changes were made')
    console.log('Run without --dry-run to execute linking')
    console.log('='.repeat(60))
  }
}

// Run the script
main()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
