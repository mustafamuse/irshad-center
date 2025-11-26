/**
 * Backfill PaymentIntent IDs for Existing Families
 *
 * IMPORTANT: This script needs migration to the new schema.
 * The Student model no longer exists.
 * TODO: Priority migration in PR 2e.
 */

console.error(
  '[SCRIPT] backfill-payment-intents disabled during schema migration'
)
console.error(
  'This script needs migration to use the new Family/BillingAssignment models.'
)
process.exit(1)
