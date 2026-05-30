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
  let exitCode = 0
  try {
    await main()
  } catch (err) {
    console.error(err)
    exitCode = 1
  } finally {
    try {
      await options.cleanup?.()
    } catch (cleanupErr) {
      console.error(cleanupErr)
      exitCode = 1
    }
  }
  process.exit(exitCode)
}
