/**
 * Standard entrypoint runner for one-off scripts.
 *
 * Runs `main`, then runs the optional `cleanup` on BOTH the success and error
 * paths (faithfully replacing the various `.finally(disconnect)` tails), and
 * exits the process with 0 on success or 1 on failure.
 *
 * Stays Prisma-free so Stripe-only scripts do not transitively pull in the DB
 * client. Scripts that need teardown pass `cleanup: () => prisma.$disconnect()`.
 */
export async function runScript(
  main: () => Promise<void>,
  options: { cleanup?: () => Promise<void> | void } = {}
): Promise<void> {
  try {
    await main()
    await options.cleanup?.()
    process.exit(0)
  } catch (err) {
    console.error(err)
    await options.cleanup?.()
    process.exit(1)
  }
}
